#!/usr/bin/env python3
"""Start mlx_lm.server after capping MLX to (total RAM − reserve)."""

from __future__ import annotations

import os
import sys


def main() -> None:
	total = int(os.environ["HYMT2_TOTAL_RAM"])
	minimum = int(os.environ["HYMT2_MIN_RAM"])
	reserve = int(os.environ["HYMT2_RESERVE_BYTES"])
	if total < minimum:
		sys.stderr.write("Hy-MT2 local serve needs more unified memory for this checkpoint.\n")
		sys.exit(1)
	import mlx.core as mx

	mx.set_memory_limit(total - reserve)
	sys.argv = ["mlx_lm.server", *sys.argv[1:]]
	from mlx_lm.server import main as server_main

	server_main()


if __name__ == "__main__":
	main()
