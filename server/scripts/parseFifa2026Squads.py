import json
import re
from pathlib import Path

import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "data" / "raw" / "fifa-2026-squadlists-english.pdf"
OUT = ROOT / "data" / "raw" / "fifa-2026-squads.json"

TEAM_NAME_MAP = {
    "Algeria": "阿尔及利亚",
    "Argentina": "阿根廷",
    "Australia": "澳大利亚",
    "Austria": "奥地利",
    "Belgium": "比利时",
    "Brazil": "巴西",
    "Cameroon": "喀麦隆",
    "Canada": "加拿大",
    "Chile": "智利",
    "Colombia": "哥伦比亚",
    "Costa Rica": "哥斯达黎加",
    "Croatia": "克罗地亚",
    "Denmark": "丹麦",
    "Ecuador": "厄瓜多尔",
    "Egypt": "埃及",
    "England": "英格兰",
    "France": "法国",
    "Germany": "德国",
    "Ghana": "加纳",
    "Iran": "伊朗",
    "Italy": "意大利",
    "Japan": "日本",
    "Korea Republic": "韩国",
    "Mexico": "墨西哥",
    "Morocco": "摩洛哥",
    "Netherlands": "荷兰",
    "Nigeria": "尼日利亚",
    "Norway": "挪威",
    "Paraguay": "巴拉圭",
    "Poland": "波兰",
    "Portugal": "葡萄牙",
    "Qatar": "卡塔尔",
    "Saudi Arabia": "沙特阿拉伯",
    "Scotland": "苏格兰",
    "Senegal": "塞内加尔",
    "Serbia": "塞尔维亚",
    "South Africa": "南非",
    "Spain": "西班牙",
    "Sweden": "瑞典",
    "Switzerland": "瑞士",
    "Tunisia": "突尼斯",
    "Türkiye": "土耳其",
    "Ukraine": "乌克兰",
    "United States": "美国",
    "Uruguay": "乌拉圭",
    "Uzbekistan": "乌兹别克斯坦",
}

POSITION_MAP = {
    "GK": "GK",
    "DF": "DF",
    "MF": "MF",
    "FW": "FW",
}


def clean(value: str) -> str:
    return value.replace("\x00", "").strip()


def normalize_token(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.upper())


def display_name_from_tokens(tokens):
    if len(tokens) <= 2:
        return " ".join(tokens)
    surname = []
    for token in tokens:
        if token.isupper() or "-" in token:
            surname.append(token)
        else:
            return " ".join([*surname, token])
    for i in range(1, len(tokens) - 1):
        if normalize_token(tokens[i]) == normalize_token(tokens[i + 1]):
            return " ".join(tokens[: i + 1])
    return " ".join(tokens[:2])


def parse_player_line(line: str):
    match = re.match(
        r"^(?P<num>\d{1,2})\s+(?P<pos>GK|DF|MF|FW)\s+(?P<rest>.+?)\s+"
        r"(?P<dob>\d{2}/\d{2}/\d{4})\s+(?P<club>.+?)\s+"
        r"(?P<height>\d{3})\s+(?P<caps>\d+)\s+(?P<goals>\d+)$",
        line,
    )
    if not match:
        return None
    rest = clean(match.group("rest"))
    tokens = rest.split()
    display_name = display_name_from_tokens(tokens)
    pos_code = match.group("pos")
    return {
        "shirtNumber": int(match.group("num")),
        "name": display_name,
        "pos": POSITION_MAP[pos_code],
        "positions": [POSITION_MAP[pos_code]],
        "caps": int(match.group("caps")),
        "goals": int(match.group("goals")),
        "club": clean(match.group("club")),
        "height": int(match.group("height")),
    }


players = []
with pdfplumber.open(PDF) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ""
        lines = [clean(line) for line in text.splitlines() if clean(line)]
        team = None
        for line in lines:
            team_match = re.match(r"^(.+?)\s+\(([A-Z]{3})\)$", line)
            if team_match:
                team = team_match.group(1)
                break
        if not team:
            continue
        country = TEAM_NAME_MAP.get(team, team)
        for line in lines:
            parsed = parse_player_line(line)
            if parsed:
                players.append(
                    {
                        "year": 2026,
                        "country": country,
                        **parsed,
                        "note": f"{team} 2026 FIFA World Cup squad list",
                        "source": "fifa-2026-official-squad-list-pdf",
                    }
                )

OUT.write_text(json.dumps(players, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Parsed {len(players)} players into {OUT}")
