# Developer: @yfeeeee
import logging

logging.basicConfig(level=logging.INFO)

from .main import build_from_env

app = build_from_env()
