"""Synthetic GeoTIFF registration tests, NOT measurements of Tirana."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

import numpy as np
import rasterio
from rasterio.transform import from_origin
from pyproj import Transformer

MODULE = Path(__file__).resolve().parents[1] / 'tools/geography/import_tirana_dem.py'
spec = importlib.util.spec_from_file_location('tirana_dem', MODULE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'synthetic.tif'
        self.values = np.array([[100,200,300],[400,500,600],[700,800,900]], dtype='float32')
        self.affine = from_origin(19.795, 41.345, .01, .01)
        self.bbox = [19.8,41.32,19.82,41.34]
        self.write()

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, crs='EPSG:4326', nodata=-9999, units='metre', point=False):
        with rasterio.open(self.path,'w',driver='GTiff',height=self.values.shape[0],width=self.values.shape[1],count=1,dtype='float32',crs=crs,transform=self.affine,nodata=nodata) as ds:
            ds.write(self.values,1)
            ds.set_band_unit(1,units)
            if point:
                ds.update_tags(AREA_OR_POINT='Point')
        self.meta = dict(url='https://example.org/synthetic.tif', acquiredAt='2026-09-08T00:00:00Z', license='Synthetic test data', surfaceType='DTM', verticalDatum='EPSG:3855', units='metre',sha256=hashlib.sha256(self.path.read_bytes()).hexdigest())

    def run_import(self, width=3, height=3):
        return module.import_dem(self.path,self.meta,self.bbox,width,height)

    def test_sample_centres_have_no_half_pixel_shift(self):
        r=self.run_import()
        np.testing.assert_allclose(r['values'],self.values.ravel(),atol=1e-7)
        self.assertEqual(r['registration'],'sample-centres')
        self.assertFalse(r['runtimeReady'])

    def test_point_registration_is_not_shifted_twice(self):
        self.write(point=True)
        np.testing.assert_allclose(self.run_import()['values'],self.values.ravel(),atol=1e-7)

    def test_interpolation_preserves_a_known_plane(self):
        r=self.run_import(5,5)
        np.testing.assert_allclose(np.array(r['values']).reshape(5,5)[1,1],300,atol=1e-7)

    def test_missing_source_is_not_replaced_with_zero(self):
        self.values[1,1]=-9999
        self.write()
        r=self.run_import(5,5)
        self.assertIsNone(r['values'][6])
        self.assertEqual(r['values'][0],100)
        self.assertGreater(r['missingSamples'],0)

    def test_partial_source_is_not_extrapolated(self):
        self.bbox[0]=19.79
        with self.assertRaisesRegex(ValueError,'cover'):
            self.run_import()

    def test_wrong_sha_is_rejected(self):
        self.meta['sha256']='0'*64
        with self.assertRaisesRegex(ValueError,'SHA256'):
            self.run_import()

    def test_unknown_crs_is_rejected(self):
        self.write(crs=None)
        with self.assertRaisesRegex(ValueError,'georeferenced'):
            self.run_import()

    def test_non_metre_band_is_rejected(self):
        self.write(units='foot')
        with self.assertRaisesRegex(ValueError,'non-metre'):
            self.run_import()

    def test_dsm_identity_is_never_downgraded_to_dtm(self):
        self.meta['surfaceType']='DSM'
        r=self.run_import()
        self.assertEqual(r['surfaceType'],'DSM')
        self.assertTrue(any('roofs' in w for w in r['warnings']))

    def test_missing_vertical_datum_is_rejected(self):
        self.meta.pop('verticalDatum')
        with self.assertRaisesRegex(ValueError,'Vertical datum'):
            self.run_import()

    def test_krgjsh_projection_does_not_swap_latitude_and_longitude(self):
        forward=Transformer.from_crs(4326,6870,always_xy=True,allow_ballpark=False)
        x,y=forward.transform(19.8188,41.3275)
        self.affine=from_origin(x-300,y+300,100,100)
        yy,xx=np.mgrid[0:6,0:6]
        self.values=(100+2*xx+3*yy).astype('float32')
        self.write(crs='EPSG:6870')
        self.bbox=[19.818,41.327,19.8195,41.328]
        r=self.run_import()
        lon,lat=np.meshgrid(np.linspace(self.bbox[0],self.bbox[2],3),np.linspace(self.bbox[3],self.bbox[1],3))
        px,py=forward.transform(lon,lat)
        expected=100+2*((px-(x-300))/100-.5)+3*(((y+300)-py)/100-.5)
        np.testing.assert_allclose(r['values'],expected.ravel(),atol=1e-5)


if __name__=='__main__':
    unittest.main()
