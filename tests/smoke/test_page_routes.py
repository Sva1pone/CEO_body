from __future__ import annotations

import unittest

import app as application


USER_PAGE_PATHS = (
    "/",
    "/registry",
    "/exercises",
    "/workout/1",
    "/report",
    "/progress",
    "/statistics",
    "/settings",
)


class UserPageSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        application.app.config.update(TESTING=True)
        self.client = application.app.test_client()

    def test_every_user_page_returns_the_react_application(self) -> None:
        for path in USER_PAGE_PATHS:
            with self.subTest(path=path):
                response = self.client.get(path)

                self.assertEqual(response.status_code, 200)
                self.assertIn(b'<div id="root"></div>', response.data)
                self.assertIn(b"/static/dist/assets/app.css", response.data)
                self.assertIn(b"/static/dist/assets/app.js", response.data)

    def test_frontend_bundle_is_available_to_the_browser(self) -> None:
        for asset_path in (
            "/static/dist/assets/app.css",
            "/static/dist/assets/app.js",
        ):
            with self.subTest(asset_path=asset_path):
                with self.client.get(asset_path) as response:
                    self.assertEqual(response.status_code, 200)
                    self.assertGreater(len(response.data), 0)

    def test_unknown_browser_path_returns_the_react_application(self) -> None:
        response = self.client.get("/route-that-does-not-exist")

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'<div id="root"></div>', response.data)

    def test_unknown_api_path_returns_a_json_not_found_error(self) -> None:
        response = self.client.get("/api/route-that-does-not-exist")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.get_json(), {"error": "API endpoint not found."})
