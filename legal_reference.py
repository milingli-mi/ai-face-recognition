"""Source-linked guidance, captured with each report; no automated legal verdict."""
COPYRIGHT_URL = 'https://www.ncac.gov.cn/xxfb/flfg/flfg_532/202103/t20210309_50530.html'
CIVIL_URL = 'https://www.court.gov.cn/zixun/xiangqing/233181.html'


def legal_guidance(mode, has_faces=False):
    topics = [
        ('是否能识别出特定自然人','第一千零一十八条','结合面部、造型、配文和传播语境，判断画面能否让人认出特定自然人。记录支持与反对这一判断的事实。'),
        ('生成、使用和公开肖像','第一千零一十九条','审查是否取得肖像权人同意，以及是否存在丑化、污损或利用信息技术伪造等侵害肖像权的情形。公益、非营利或标注 AI 生成均不能单独决定结论。'),
        ('是否符合法定例外','第一千零二十条','逐项核对法定情形。例如新闻报道中的使用是否不可避免，个人学习等对已公开肖像的使用是否在必要范围内。广告或公开推广要单独审查。'),
        ('授权具体覆盖哪些用途','第一千零二十一、第一千零二十二条','核对同意对象、投放渠道、使用期限、AI 改绘和商业用途。对肖像使用条款理解有争议时，依法作有利于肖像权人的解释；解除许可需结合约定及法定条件。'),
        ('发现疑似冒用后如何处理','第九百九十五、第九百九十七条','保存原图、生成或发布页面、链接、时间和沟通材料，视情况请求停止侵害。申请人格权行为禁令需要相应证据，并符合法定紧迫性等条件。')]
    articles = [dict(title=t, law='《民法典》'+n, text=v, url=CIVIL_URL, source='最高人民法院') for t,n,v in topics]
    return {"jurisdiction": "中国大陆", "checked_on": "2026-11-21", "articles": articles,
            "notice": "相似分仅供筛查。是否涉及肖像权侵害，需要判断人物可识别性、实际制作或使用行为、同意范围及法定例外。系统无法凭图片确认生成方式、授权或侵权。",
            "aid": ({"phone": "12348", "title": "公共法律服务与法律援助",
                     "url": "https://www.12348.gov.cn/pub/12348/bszn/flyz/",
                     "source_url": "https://www.moj.gov.cn/pub/sfbgwapp/zwgk/tzggApp/202501/t20250113_512995.html",
                     "text": "可拨打 12348 咨询，或通过中国法律服务网查询当地机构及申请指南。是否获得法律援助由受理机构依据事项范围、经济状况等条件审查。",
                     "materials": ["可用于说明本人肖像的原始照片、争议图片及其上下文", "疑似侵权页面网址、账号、发布时间与完整截图", "授权协议、沟通记录及相关损失材料", "本次检测报告与原始文件"]} if mode == 'personal' else None)}
