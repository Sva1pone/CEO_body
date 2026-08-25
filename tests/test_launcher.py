import argparse
import importlib.util
from pathlib import Path
from unittest import TestCase
from unittest.mock import Mock, patch


def load_launcher_module():
    module_path = Path(__file__).parents[1] / "app.py"
    spec = importlib.util.spec_from_file_location("ceo_body_launcher", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LauncherTests(TestCase):
    def test_port_validation_rejects_browser_blocked_sip_ports(self) -> None:
        launcher = load_launcher_module()

        for port in ("5060", "5061"):
            with self.assertRaisesRegex(argparse.ArgumentTypeError, "блокируются браузерами"):
                launcher.parse_port_argument(port)

    def test_browser_uses_requested_port(self) -> None:
        launcher = load_launcher_module()
        callback_holder = {}

        def capture_timer(_delay, callback):
            callback_holder["callback"] = callback
            return Mock()

        with patch.object(launcher, "Timer", side_effect=capture_timer), patch.object(
            launcher.webbrowser, "open"
        ) as browser_open:
            launcher.open_application_in_browser(5070)
            callback_holder["callback"]()

            browser_open.assert_called_once_with("http://127.0.0.1:5070")
