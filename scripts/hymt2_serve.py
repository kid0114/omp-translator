#!/usr/bin/env python3
"""Start mlx_lm.server after capping MLX to (total RAM − 10 GiB)."""

from __future__ import annotations

import os
import sys

RESERVE_BYTES = 10 * 1024**3
MIN_RAM_BYTES = 32 * 1024**3


def main() -> None:
	total = int(os.environ["HYMT2_TOTAL_RAM"])
	if total < MIN_RAM_BYTES:
		sys.stderr.write("Hy-MT2 local serve needs 32 GiB+ unified memory.\n")
		sys.exit(1)
	import mlx.core as mx

	mx.set_memory_limit(total - RESERVE_BYTES)
	sys.argv = ["mlx_lm.server", *sys.argv[1:]]
	from mlx_lm.server import main as server_main

	server_main()


if __name__ == "__main__":
	main()
