import json
from pathlib import Path
from legal_assistant.assistant import answer
context=json.loads((Path(__file__).parent/'fixtures/context.json').read_text('utf8'))
print(json.dumps(answer('商家把像我的 AI 图片用在广告里，我该保留哪些材料？',context),ensure_ascii=False,indent=2))
