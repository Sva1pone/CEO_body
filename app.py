from __future__ import annotations

import argparse
import sys
import webbrowser
from threading import Timer

from backend import application
from backend.config import HOST, PORT, validate_port


def parse_port_argument(value: str) -> int:
    try:
        return validate_port(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(str(error)) from error


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Локальный сервер СЕО тела")
    parser.add_argument(
        "--headless",
        action="store_true",
        help="запустить сервер без автоматического открытия браузера",
    )
    parser.add_argument(
        "--port",
        type=parse_port_argument,
        default=PORT,
        help="локальный порт сервера",
    )
    return parser.parse_args()


def open_application_in_browser(port: int) -> None:
    Timer(1, lambda: webbrowser.open(f"http://{HOST}:{port}")).start()


def main() -> None:
    arguments = parse_arguments()

    application.init_db()

    if not arguments.headless:
        open_application_in_browser(arguments.port)

    application.app.run(host=HOST, port=arguments.port, debug=False)


if __name__ == "__main__":
    main()
else:
    sys.modules[__name__] = application
