import os
import json
from openai import OpenAI
from legal_reference import legal_guidance

# 白名单关键词：命中任一才视为相关法律问题（统一小写比较）
LEGAL_KEYWORDS = [
    "肖像", "人脸", "换脸", "ai生成图", "ai图片", "deepfake", "深度伪造",
    "授权", "许可", "取证", "侵权", "民法典", "人格权", "隐私", "名誉",
    "商用", "下架", "赔偿", "维权", "相似度", "海报", "广告", "投广",
]


def _is_legal_related(question: str) -> bool:
    q = (question or "").lower()
    return any(kw in q for kw in LEGAL_KEYWORDS)


def answer(question, context):
    # 白名单粗筛：与 AI 肖像/授权/取证明显无关的直接拒答
    if not _is_legal_related(question):
        return dict(
            status="ok",
            answer="本助手仅可回答 AI 肖像、肖像授权、取证相关的法律问题。请补充与肖像权相关的具体情形。",
            citations=[],
            followups=["您的问题涉及的是肖像使用、授权还是侵权取证？"]
        )

    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        return dict(
            status="error",
            answer="未配置 DEEPSEEK_API_KEY，请先配置环境变量",
            citations=[],
            followups=[]
        )

    try:
        # 1) 安全获取 context，防止全局助手传入 None 或非 dict
        if not isinstance(context, dict):
            context = {}
            
        mode = context.get("mode", "personal")
        guidance = legal_guidance(mode=mode)
        articles = guidance["articles"]
        notice = guidance["notice"]
        aid = guidance.get("aid")

        # 2) 拼法条文本进 prompt（只放正文和出处，url 留给 citations）
        law_text = "\n".join(
            f"{a['law']} {a['title']}：{a['text']}（来源：{a['source']}）"
            for a in articles
        )

        # 3) 个人维权场景把建议保留的材料也带给模型
        materials_text = ""
        if aid and aid.get("materials"):
            materials_text = "建议提示用户保留的材料：" + "；".join(aid["materials"])

        # 4) 构造背景资料。如果字段太少（全局助手），用自然语言兜底说明
        if len(context) <= 1:
            context_prompt = "当前为全局独立法律咨询，未绑定任何具体的视觉检测报告。"
        else:
            context_prompt = json.dumps(context, ensure_ascii=False)

        prompt = f"""
你是AI肖像权法律参考助手。
【背景资料】
{context_prompt}
【相关法条指引】
{law_text}
【重要提示】
{notice}
{materials_text}
用户问题：{question}
要求：
1. 围绕AI肖像侵权、取证、授权给出法律参考和实操建议；
2. 不作出确定侵权与否的司法判定；涉及相似度时，说明分数仅供筛查，需结合可识别性、使用场景、授权情况判断，并追问这些事实；
3. 输出通俗易懂；
4. 若问题与AI肖像权法律无关，请礼貌说明范围并拒答。
"""

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": "你是一名谨慎、专业的AI肖像权法律参考助手。"},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1500,
            timeout=30,
        )

        llm_result = response.choices[0].message.content

        # 5) citations 从 articles 构造，带法条名、链接、出处
        citations = [
            dict(law=f"{a['law']} {a['title']}", url=a["url"], source=a["source"])
            for a in articles
        ]

        followups = ["是否有对方使用图片的授权？", "AI图片在哪些平台投放？"]
        if aid and aid.get("phone"):
            followups.append(f"可拨打 {aid['phone']} 咨询法律援助")

        return dict(
            status="ok",
            answer=llm_result,
            citations=citations,
            followups=followups
        )

    except Exception as e:
        error_msg = str(e).lower()

        if "401" in error_msg or "authentication" in error_msg:
            fallback = "DeepSeek API 密钥无效，请检查 DEEPSEEK_API_KEY 配置。"
        elif "402" in error_msg or "insufficient balance" in error_msg:
            fallback = "DeepSeek 账户余额不足，请充值后重试。"
        elif "429" in error_msg or "rate limit" in error_msg:
            fallback = "请求过于频繁，请稍后重试。"
        elif "timeout" in error_msg:
            fallback = "模型响应超时，请稍后重试。"
        else:
            fallback = "服务暂时异常，请稍后重试，您仍可以查看页面上的法律参考内容。"

        return dict(
            status="error",
            answer=fallback,
            citations=[],
            followups=[]
        )