"""Local VisionJudge server. All browser actions use the same local HTTP API."""
from __future__ import annotations

from launch_id import instance_key
import judge_login
from legal import legal_guidance
# 👇 新增引入大模型逻辑
from legal_assistant.assistant import answer
# 👆 ------------------
import argparse
import base64
import binascii
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
import sys
import threading
from urllib.parse import unquote, urlsplit
import webbrowser

from engine import Engine, MAX_BYTES, ROOT
from repository import clean_text, json_bytes
from repository import Repository

EXAMPLES = {'resized': ('chart-small.jpg','色卡.jpg','缩放色卡','用合成图案测试图像比对')}
WEB_FILES = {'/':('index.html','text/html'), '/index.html':('index.html','text/html'),
             '/app.js':('app.js','application/javascript'), '/style.css':('style.css','text/css'),
             '/icons.svg':('icons.svg','image/svg+xml')}
HEX = r'[a-f0-9]'
ANALYSIS_SLOT = threading.BoundedSemaphore(1)


class ApiHandler(BaseHTTPRequestHandler):
    server_version = 'VisionJudge/2'

    def send(self, body, mime='application/json; charset=utf-8', status=200, attachment=None):
        if isinstance(body, (dict,list)):
            body = json_bytes(body)
        self.send_response(status)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy','same-origin')
        self.send_header('X-Frame-Options', 'DENY')
        if attachment:
            self.send_header('Content-Disposition', f'attachment; filename="{attachment}"')
        self.end_headers()
        self.wfile.write(body)

    def read_body(self, maximum):
        length = int(self.headers.get('Content-Length', '-1'))
        if length < 0 or length > maximum:
            raise ValueError('请求大小无效或超过文件限制')
        body = self.rfile.read(length)
        if len(body) != length:
            raise ValueError('文件传输不完整')
        return body

    def json_input(self, maximum=24000):
        if self.headers.get_content_type() != 'application/json':
            raise ValueError('此接口需要 JSON')
        value = json.loads(self.read_body(maximum))
        if not isinstance(value, dict):
            raise ValueError('JSON 格式错误')
        return value

    def file_input(self):
        if self.headers.get_content_type() != 'application/octet-stream':
            raise ValueError('请以原始文件上传')
        title = unquote(self.headers.get('X-Filename','image')).replace(chr(92),'/').split('/')[-1]
        return self.read_body(MAX_BYTES), clean_text(title,180,'文件名')

    def get_route(self, path):
        repo = self.server.repo
        if path in WEB_FILES:
            name,mime = WEB_FILES[path]
            return self.send((ROOT/'web'/name).read_bytes(),mime+'; charset=utf-8')
        if path == '/api/workspace':
            state = repo.home()
            state['portrait_law'] = {mode:legal_guidance(mode) for mode in ('personal','compliance')}
            state['runtime'] = self.server.engine.runtime
            state['examples'] = [{'id':key,'name':v[2],'description':v[3]} for key,v in EXAMPLES.items()]
            return self.send(state)
        if path == '/api/health':
            return self.send({'app':'VisionJudge','version':'2.2','storage':'test-local','instance': self.server.instance,'runtime':self.server.engine.runtime})
        m = re.fullmatch(r'/api/examples/([a-z-]+)/preview',path)
        if m and m[1] in EXAMPLES:
            filename = EXAMPLES[m[1]][0]
            return self.send((ROOT/'samples'/filename).read_bytes(),'image/png' if filename.endswith('.png') else 'image/jpeg')
        m = re.fullmatch(fr'/api/images/({HEX}{{64}})',path)
        if m:
            return self.send(repo.preview(m[1]), 'image/jpeg')
        m = re.fullmatch(fr'/api/gallery/({HEX}{{64}})/faces/(\d+)',path)
        if m:
            return self.send(repo.face_preview(m[1],int(m[2])),'image/jpeg')
        m = re.fullmatch(fr'/api/reports/({HEX}{{32}})(?:/(evidence|json))?',path)
        if m:
            if m[2]=='evidence':
                return self.send(repo.evidence(m[1]),'application/zip',attachment='VisionJudge-'+m[1][:8]+'.zip')
            report = repo.report(m[1])
            if m[2]=='json':
                return self.send(report['snapshot'],attachment='VisionJudge-'+m[1][:8]+'.json')
            return self.send(report)
        raise KeyError()

    def post_route(self,path):
        repo = self.server.repo
        engine = self.server.engine
        
        # 👇 新增的大模型聊天接口 👇
        if path == '/api/legal-chat':
            # 直接读取前端发来的 JSON
            data = self.json_input()
            question = data.get('question', '')
            context = data.get('context', {})
            # 调用你的 assistant.py 核心逻辑
            result = answer(question, context)
            # 返回给前端
            return self.send(result, status=200)
        # 👆 ---------------------- 👆

        if path == '/api/folders':
            return self.send(repo.folder(self.json_input().get('name')))
        m = re.fullmatch(fr'/api/reports/({HEX}{{32}})/review',path)
        if m:
            return self.send(repo.review(m[1],self.json_input()))
        if not ANALYSIS_SLOT.acquire(blocking=False):
            return self.send({'error':'另一张图片正在核查，请稍后再试。'},status=429)
        try:
            if path == '/api/compare':
                data = self.json_input(46 * 1024 * 1024)
                uploads = []
                for key in ('reference', 'query'):
                    item = data.get(key)
                    if not isinstance(item, dict) or not isinstance(item.get('data'), str):
                        raise ValueError('请分别上传原创素材和疑似侵权作品')
                    name = clean_text(item.get('name'), 180, '文件名')
                    if len(item['data']) > ((MAX_BYTES + 2) // 3) * 4:
                        raise ValueError('每张图片需在 16 MB 以内')
                    try:
                        raw = base64.b64decode(item['data'], validate=True)
                    except (ValueError, binascii.Error) as exc:
                        raise ValueError('图片传输格式无效，请重新上传') from exc
                    uploads.extend((raw, name))
                return self.send(repo.compare(*uploads, data.get('folder'), engine), status=201)
            if path == '/api/check':
                raw,name = self.file_input()
                return self.send(repo.inspect(raw,name,self.headers.get('X-Folder','inbox'),engine),status=201)
            if path == '/api/gallery':
                raw,name = self.file_input()
                title = clean_text(unquote(self.headers.get('X-Title','')) or name,180,'素材名称')
                source = clean_text(unquote(self.headers.get('X-Source','')) or '手动导入',240,'来源')
                sha,added = repo.import_reference(raw,title,name,source,'使用范围待人工核查',engine)
                return self.send({'sha':sha,'added':added},status=201 if added else 200)
            m = re.fullmatch(r'/api/examples/([a-z-]+)/check',path)
            if m and m[1] in EXAMPLES:
                name,title,*_ = EXAMPLES[m[1]]
                return self.send(repo.inspect((ROOT/'samples'/name).read_bytes(),title,
                                              self.json_input().get('folder','inbox'),engine),status=201)
            m = re.fullmatch(fr'/api/gallery/({HEX}{{64}})/check',path)
            if m:
                with repo.database() as db:
                    ref = db.execute('SELECT a.raw,g.original FROM gallery g JOIN assets a ON g.sha=a.sha WHERE g.sha=?',(m[1],)).fetchone()
                if not ref:
                    raise KeyError()
                return self.send(repo.inspect(ref['raw'],ref['original'],self.json_input().get('folder','inbox'),engine),status=201)
            raise KeyError()
        finally:
            ANALYSIS_SLOT.release()

    def handle_api(self,post=False):
        try:
            base=judge_login.origin(self.headers.get('Host',''),self.server.server_port)
            path=urlsplit(self.path).path
            origin=self.headers.get('Origin')
            opaque=origin in (None,'null')
            browser_same_site=opaque and self.headers.get('Sec-Fetch-Site')=='same-origin'
            form_login=opaque and path=='/login'
            if not base or (post and origin!=base and not browser_same_site and not form_login):
                return self.send({'error':'来源不匹配'},status=403)
            if not judge_login.gate(self,path,post,base):
                return
            (self.post_route if post else self.get_route)(path)
        except KeyError:
            self.send({'error':'记录或文件不存在'},status=404)
        except (ValueError, TypeError) as exc:
            self.send({'error':str(exc)},status=400)
        except (BrokenPipeError,ConnectionResetError,ConnectionAbortedError):
            pass
        except Exception as exc:
            print('处理请求失败：',repr(exc),file=sys.stderr,flush=True)
            self.send({'error':'处理未完成，请查看服务窗口的错误信息。'},status=500)

    def do_GET(self):
        self.handle_api()

    def do_POST(self):
        self.handle_api(True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=18426)
    parser.add_argument('--data',type=Path,default=ROOT/'data')
    parser.add_argument('--cpu',action='store_true',help='Force ArcFace CPU inference')
    parser.add_argument('--open',action='store_true',help='Open browser when ready')
    args=parser.parse_args()
    url=f'http://127.0.0.1:{args.port}'
    with ThreadingHTTPServer(('127.0.0.1',args.port),ApiHandler) as server:
        server.judge_password=judge_login.password()
        server.instance=instance_key()
        server.repo=Repository(args.data/'gallery.sqlite3')
        server.engine=Engine(cpu_only=args.cpu)
        server.repo.seed(server.engine)
        print(f'VisionJudge {url} | ArcFace {server.engine.runtime["provider"]}',flush=True)
        if args.open:
            threading.Timer(0.5,webbrowser.open,args=(url,)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__=='__main__':
    main()
