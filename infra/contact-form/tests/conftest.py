"""Pytest configuration — add src/ to path so app module is importable."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
