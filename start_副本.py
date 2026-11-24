"""Bootstrap the offline Windows runtime and open the local workbench."""
from pathlib import Path
import json
import os
import socket
from launch_id import instance_key
import platform
import subprocess
import sys
from urllib.request import urlopen
import venv
import webbrowser

ROOT = Path(__file__).resolve().parent
RUNTIME = ROOT / '.venv' / 'Scripts' / 'python.exe'


def main():
    os.chdir(ROOT)
    headless = '--no-browser' in sys.argv[1:]
    if sys.version_info[:2] != (3,14) or platform.machine().upper() not in ('AMD64','X86_64') or os.name != 'nt':
        print("This offline Windows package needs 64-bit Python 3.14. See README.md for other systems.")
        return 2
    key = instance_key()
    port = None
    # A different running checkout is left alone. Keep the first free local port.
    for candidate in range(18426, 18427):
        with socket.socket() as sock:
            if hasattr(socket,'SO_EXCLUSIVEADDRUSE'):
                sock.setsockopt(socket.SOL_SOCKET,socket.SO_EXCLUSIVEADDRUSE,1)
            try:
                sock.bind(('127.0.0.1',candidate))
            except OSError:
                pass
            else:
                if port is None:
                    port = candidate
                continue
        url = f'http://127.0.0.1:{candidate}'
        try:
            with urlopen(url+'/login',timeout=1) as response:
                existing=response.read(16384)
            if b'VisionJudge' in existing:
                if not headless:
                    webbrowser.open(url)
                print('VisionJudge 2.2 is ready at '+url)
                return 0
        except (ValueError,OSError):
            continue
    if port is None:
        print('No free local port in 18426.')
        return 1
    if not RUNTIME.exists():
        print('Preparing the local Python runtime...',flush=True)
        venv.EnvBuilder(with_pip=True).create(ROOT/'.venv')
    test = subprocess.run([str(RUNTIME),'-c','import cv2, onnxruntime, numpy, PIL'],
                          stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    if test.returncode:
        subprocess.run([str(RUNTIME),'-m','pip','install','--no-index','--find-links',str(ROOT/'wheels'),
                        '--disable-pip-version-check','-r',str(ROOT/'requirements.txt')],check=True)
    print('Starting the models and reference index...',flush=True)
    args = [str(RUNTIME),str(ROOT/'server.py'),'--port',str(port)]
    if not headless:
        args.append('--open')
    return subprocess.call(args)


if __name__=='__main__':
    sys.exit(main())

