# A fake OpenAI-compatible endpoint for InterpTest: behaviour picked by the model name.
import json, sys, time
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        model = body['model']
        if self.path.endswith('/messages'):   # 2.26: Claude's own API
            def sendj(code, obj):
                data = json.dumps(obj).encode()
                self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
            if self.headers.get('x-api-key') != 'good-key' or self.headers.get('anthropic-version') != '2023-06-01':
                return sendj(401, {'type': 'error', 'error': {'type': 'authentication_error', 'message': 'invalid x-api-key'}})
            if model == 'empty': return sendj(200, {'content': []})
            return sendj(200, {'content': [{'type': 'text', 'text': 'sys=' + body['system'] + ';user=' + body['messages'][0]['content'] + ';max=' + str(body['max_tokens'])}]})
        auth = self.headers.get('Authorization', '')
        def send(code, obj, raw=None):
            data = raw if raw is not None else json.dumps(obj).encode()
            self.send_response(code); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(data)
        if auth != 'Bearer good-key':
            return send(401, {'error': {'message': 'Invalid API Key'}})
        user = body['messages'][1]['content']
        if model == 'slow': time.sleep(4)
        if model == 'garbage': return send(200, None, b'<html>oops</html>')
        if model == 'echo': return send(200, {'choices': [{'message': {'role': 'assistant', 'content': 'user=' + user + ';max=' + str(body['max_tokens'])}}]})
        if model == 'chatty':
            content = 'Sure! Here you go:\n```json\n{"matches":[{"k":"a","q":"12"},{"k":"b","q":null},{"k":"zzz","q":12},{"k":"c","q":999}]}\n```'
        elif model == 'empty':
            content = ''
        else:
            # "real": map by keyword
            lines = [l for l in user.split('Reports:')[1].strip().split('\n') if l]
            qlines = [l for l in user.split('Reports:')[0].split('\n')[1:] if ':' in l]
            ids = {l.split(':',1)[1].strip(): int(l.split(':')[0]) for l in qlines}
            m = []
            for l in lines:
                k, t = l.split(':', 1)
                q = None
                if 'gym' in t or 'legs' in t: q = ids.get('Weights / cable session')
                if 'laps' in t or 'pool' in t: q = ids.get('Swim session')
                m.append({'k': k.strip(), 'q': q})
            content = json.dumps({'matches': m})
        send(200, {'choices': [{'message': {'role': 'assistant', 'content': content}}]})
HTTPServer(('127.0.0.1', int(sys.argv[1])), H).serve_forever()
