"""Offline source-reader regression tests; fixtures are explicitly synthetic."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[1] / 'webapp/scripts/tirana/read_osm_extract.py'
spec = importlib.util.spec_from_file_location('read_osm_extract', path)
reader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reader)


class SourceSelection(unittest.TestCase):
    def fixture(self):
        return [
            {'type': 'node', 'id': 1, 'lat': 41.3, 'lon': 19.6, 'tags': {}},
            {'type': 'node', 'id': 2, 'lat': 41.3, 'lon': 20.1, 'tags': {}},
            {'type': 'node', 'id': 3, 'lat': 40.0, 'lon': 19.8, 'tags': {}},
            {'type': 'way', 'id': 10, 'nodes': [1, 2], 'tags': {'highway': 'service', 'access': 'private'}},
            {'type': 'way', 'id': 11, 'nodes': [2, 3], 'tags': {}},
            {'type': 'relation', 'id': 20, 'tags': {'building': 'yes', 'type': 'multipolygon'},
             'members': [{'type': 'way', 'ref': 10, 'role': 'outer'}, {'type': 'way', 'ref': 11, 'role': 'outer'}]},
        ]

    def test_crossing_road_with_both_endpoints_outside_and_recursive_members_are_kept(self):
        result = reader.select_region(self.fixture())
        self.assertEqual(len(result), 6)
        self.assertEqual(next(e for e in result if e['type'] == 'way')['tags']['access'], 'private')

    def test_missing_member_fails_instead_of_cutting_building(self):
        data = self.fixture()
        data[-1]['members'][1]['ref'] = 999
        with self.assertRaisesRegex(ValueError, 'Missing source way/999'):
            reader.select_region(data)

    def test_duplicate_identity_fails(self):
        data = self.fixture()
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            reader.select_region(data + [data[0]])

    def test_xml_preserves_tags_and_member_order(self):
        xml = '<osm version="0.6"><node id="1" lat="41.3" lon="19.8"><tag k="office" v="company"/></node><node id="2" lat="41.31" lon="19.81"/><way id="10"><nd ref="1"/><nd ref="2"/><tag k="highway" v="service"/><tag k="access" v="private"/></way></osm>'
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / 'synthetic.osm'
            source.write_text(xml)
            result = reader.select_region(reader.read_elements(source))
        self.assertEqual(result[0]['tags']['office'], 'company')
        self.assertEqual(result[-1]['nodes'], [1, 2])


if __name__ == '__main__':
    unittest.main()
