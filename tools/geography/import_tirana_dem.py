"""Import a LICENSED local GeoTIFF into a WGS84 elevation review grid.

No network fetch, guessed hills, datum conversion, smoothing, hole filling or
WORLD replacement. Metadata must describe the actual acquired source file.
"""
import argparse
import hashlib
import json
import math
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

import numpy as np
import rasterio
from pyproj import CRS
from pyproj.transformer import TransformerGroup
from rasterio.windows import Window


def validate_metadata(path, metadata):
    url = urlsplit(metadata.get('url', ''))
    if url.scheme != 'https' or not url.hostname or url.username or url.password:
        raise ValueError('Provenance requires an HTTPS source URL without credentials')
    if not isinstance(metadata.get('license'), str) or not metadata['license'].strip():
        raise ValueError('Source license required')
    date = datetime.fromisoformat(metadata.get('acquiredAt', '').replace('Z', '+00:00'))
    if date.tzinfo is None:
        raise ValueError('Acquisition timestamp must include a timezone')
    if metadata.get('surfaceType') not in ('DTM', 'DSM'):
        raise ValueError('Declare DTM or DSM; never relabel a DSM as bare ground')
    datum = metadata.get('verticalDatum')
    if not isinstance(datum, str) or not datum.strip() or metadata.get('units') != 'metre':
        raise ValueError('Vertical datum and metre units required')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(part)
    if metadata.get('sha256') != digest.hexdigest():
        raise ValueError('Source SHA256 does not match the input GeoTIFF')


def import_dem(path, metadata, bbox, width, height):
    path = Path(path)
    validate_metadata(path, metadata)
    if not isinstance(width, int) or not isinstance(height, int) or min(width, height) < 2 or width * height > 4000000:
        raise ValueError('Grid requires 2..4,000,000 samples and at least two rows/columns')
    if len(bbox) != 4 or not all(math.isfinite(v) for v in bbox):
        raise ValueError('Invalid WGS84 extent')
    west, south, east, north = bbox
    if not (-180 <= west < east <= 180 and -89 < south < north < 89):
        raise ValueError('Invalid WGS84 extent')
    lons, lats = np.meshgrid(np.linspace(west, east, width), np.linspace(north, south, height))
    with rasterio.open(path) as ds:
        if ds.crs is None or ds.count != 1 or ds.width < 2 or ds.height < 2:
            raise ValueError('A single-band, georeferenced elevation GeoTIFF is required')
        if ds.scales[0] != 1 or ds.offsets[0] != 0:
            raise ValueError('Normalize encoded band scale/offset before import')
        if ds.units[0] and ds.units[0].lower() not in ('metre', 'meter', 'm', 'metres', 'meters'):
            raise ValueError('GeoTIFF declares non-metre band units')
        crs = CRS.from_user_input(ds.crs)
        if len(crs.axis_info) != 2 or crs.is_compound:
            raise ValueError('Use a horizontal CRS and separately documented height datum')
        # Disallow ballpark shifts: a missing datum operation must be an error.
        group = TransformerGroup('EPSG:4326', crs, always_xy=True, allow_ballpark=False)
        if not group.best_available or not group.transformers:
            raise ValueError('Required CRS transformation grid is unavailable; no fallback shift')
        transform = group.transformers[0]
        xs, ys = transform.transform(lons, lats, errcheck=True)
        inverse = ~ds.transform
        # Rasterio/GDAL's transform describes pixel corners, even for point data.
        # Subtract half a pixel exactly once to address the sample centres.
        cols = inverse.a * xs + inverse.b * ys + inverse.c - .5
        rows = inverse.d * xs + inverse.e * ys + inverse.f - .5
        for coordinate in (cols, rows):
            close = np.abs(coordinate - np.rint(coordinate)) < 1e-8
            coordinate[close] = np.rint(coordinate[close])
        if not np.isfinite(cols).all() or not np.isfinite(rows).all():
            raise ValueError('Coordinate transformation produced non-finite samples')
        if cols.min() < 0 or rows.min() < 0 or cols.max() > ds.width-1 or rows.max() > ds.height-1:
            raise ValueError('Source does not cover the requested sample centres; do not extrapolate')
        i = np.minimum(np.floor(cols).astype('int64'), ds.width-2)
        j = np.minimum(np.floor(rows).astype('int64'), ds.height-2)
        x0, y0, x1, y1 = int(i.min()), int(j.min()), int(i.max())+2, int(j.max())+2
        if (x1-x0)*(y1-y0) > 25000000:
            raise ValueError('Source window too large; tile the import without reducing source detail')
        data = ds.read(1, masked=True, window=Window(x0, y0, x1-x0, y1-y0)).astype('float64')
        ii, jj = i-x0, j-y0
        tx, tz = cols-i, rows-j
        weights = [(1-tx)*(1-tz), tx*(1-tz), (1-tx)*tz, tx*tz]
        samples = [data[jj,ii], data[jj,ii+1], data[jj+1,ii], data[jj+1,ii+1]]
        missing = np.zeros((height, width), dtype=bool)
        values = np.zeros((height, width), dtype='float64')
        for weight, sample in zip(weights, samples):
            value = np.asarray(sample.filled(np.nan))
            valid = ~np.ma.getmaskarray(sample) & np.isfinite(value)
            missing |= (weight > 0) & ~valid
            values += weight * np.where(valid, value, 0)
        flat = [None if absent else float(value) for value, absent in zip(values.ravel(), missing.ravel())]
        source = dict(metadata)
        source.update(horizontalCrs=crs.to_string(), affine=list(ds.transform)[:6],
                      pixelRegistration=ds.tags().get('AREA_OR_POINT', 'Area'),
                      nativeDimensions=[ds.width, ds.height],
                      nativePixelSize=[math.hypot(ds.transform.a, ds.transform.d), math.hypot(ds.transform.b, ds.transform.e)],
                      horizontalOperation=transform.description,
                      horizontalOperationAccuracyMetres=transform.accuracy)
    return dict(version=1, kind='tirana-elevation-grid', stage='terrain-review', runtimeReady=False,
                horizontalCrs='EPSG:4326', bbox=list(bbox), width=width, height=height,
                rowOrder='north-to-south', registration='sample-centres', units='metre',
                verticalDatum=metadata['verticalDatum'], surfaceType=metadata['surfaceType'],
                values=flat, source=source,
                resampling='bilinear; any positive-weight no-data input produces null',
                missingSamples=int(missing.sum()),
                warnings=['Resampling adds no survey accuracy.',
                          'DSM roofs and vegetation are not ground elevation.' if metadata['surfaceType']=='DSM' else 'DTM source accuracy still requires metadata review.',
                          'Lake levels, bridge decks, terrain mesh/collision and city-frame migration are not approved by this import.'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('geotiff', type=Path)
    parser.add_argument('metadata', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--bbox', type=float, nargs=4, required=True, metavar=('WEST','SOUTH','EAST','NORTH'))
    parser.add_argument('--width', type=int, required=True)
    parser.add_argument('--height', type=int, required=True)
    args = parser.parse_args()
    if args.output.resolve() in (args.geotiff.resolve(), args.metadata.resolve()) or args.output.exists():
        parser.error('Choose a new output path; inputs and existing outputs are never overwritten')
    try:
        result = import_dem(args.geotiff, json.loads(args.metadata.read_text()), args.bbox, args.width, args.height)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(',',':'))+'\n')
    except (ValueError, OSError, rasterio.errors.RasterioError) as exc:
        parser.exit(1, f'Import rejected: {exc}\n')
    print(f'Terrain review only: {len(result["values"])} samples, {result["missingSamples"]} missing; runtimeReady=false')


if __name__ == '__main__':
    main()
