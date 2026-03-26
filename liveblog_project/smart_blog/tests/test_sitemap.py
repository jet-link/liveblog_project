"""Tests for public sitemap index and robots.txt."""
from django.test import Client, TestCase


class PublicSitemapTests(TestCase):
    def test_sitemap_index_200(self):
        r = Client().get("/sitemap.xml")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"sitemapindex", r.content)

    def test_robots_txt_contains_sitemap(self):
        r = Client().get("/robots.txt")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"Sitemap:", r.content)
        self.assertIn(b"sitemap.xml", r.content)
