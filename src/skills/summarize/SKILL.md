---
name: summarize
description: Summarize public content — articles/text, YouTube videos, or podcasts — by fetching text or transcripts.
---

# Summarize

Summarize public content from three sources: **articles/text**, **YouTube videos**, and **podcasts**.
Use the tools you already have (`web_fetch`, `exec`, `web_search`) — no external CLI needed.

## When to use (trigger phrases)

Use this skill when the user asks any of:

- "summarize this", "what's this about?", "résume-moi ça"
- "summarize this article/page/link/URL"
- "summarize this video", "what does this YouTube video say?"
- "summarize this podcast", "what's this episode about?"
- "transcribe this video/podcast"
- "donne-moi un résumé de cette vidéo/podcast/article"

## Content type detection

Identify the content type from the URL or user description:

| Type               | URL patterns / clues                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| **Text / Article** | Any URL not matching video/podcast patterns, or raw text pasted by user       |
| **YouTube Video**  | `youtube.com/watch`, `youtu.be/`, `youtube.com/shorts/`                       |
| **Podcast**        | Spotify, Apple Podcasts, podcast RSS feeds, or user explicitly says "podcast" |

---

## 1. Text / Article

**Goal:** Extract the readable text from a web page and summarize it.

**Steps:**

1. Use `web_fetch` with the URL to get the page content.
2. If the content is too long (> 30,000 chars), work with the first 30,000 chars.
3. Produce a structured summary:
   - **Title** of the article
   - **Key points** (3–7 bullet points)
   - **Summary** (1–2 paragraphs)

**Example flow:**

```
web_fetch(url: "https://example.com/article")
→ Read the returned text
→ Generate the summary from the extracted content
```

If `web_fetch` fails (e.g. paywall, bot protection), tell the user and suggest they paste the text directly.

---

## 2. YouTube Video

**Goal:** Get the video transcript/subtitles and summarize them.

**Steps:**

1. Extract the video ID from the URL.
   - `youtube.com/watch?v=VIDEO_ID` → extract `VIDEO_ID`
   - `youtu.be/VIDEO_ID` → extract `VIDEO_ID`
2. Fetch the transcript using the public YouTube transcript endpoint via `exec`:

```bash
curl -s "https://www.youtube.com/watch?v=VIDEO_ID" | grep -o '"captionTracks":\[.*?\]' | head -1
```

3. If that gives you a `baseUrl`, fetch the XML captions:

```bash
curl -s "CAPTION_BASE_URL" | sed 's/<[^>]*>//g'
```

4. **Alternative — more reliable method:** Use `yt-dlp` (if installed) to extract subtitles:

```bash
yt-dlp --skip-download --write-auto-sub --sub-lang en,fr --sub-format vtt --convert-subs srt -o "/tmp/yt_%(id)s" "VIDEO_URL" 2>/dev/null && cat /tmp/yt_*.srt
```

5. **Alternative — fallback via web:** If other methods fail, try fetching a transcript from a third-party service:

```bash
curl -s "https://youtubetranscript.com/?server_vid2=VIDEO_ID"
```

6. Once you have the transcript text, produce a structured summary:
   - **Video title** (extract from the page if possible)
   - **Key points** (3–7 bullet points)
   - **Summary** (1–2 paragraphs)
   - If the user asked for the full transcript, return it formatted cleanly.

**Important:** If no subtitles/captions are available (some videos have none), tell the user clearly: "This video has no available subtitles or auto-generated captions. I cannot transcribe it."

---

## 3. Podcast

**Goal:** Get a transcript or show notes and summarize them.

**Steps:**

1. **Try to find a transcript:**
   - Use `web_search` to find a transcript: `"PODCAST_NAME EPISODE_TITLE transcript"`
   - Some podcast platforms provide transcripts directly (e.g., Spotify shows, some Apple Podcast pages).

2. **If a transcript page is found**, use `web_fetch` to extract the text and summarize it.

3. **If no transcript is available**, try to get **show notes**:
   - Use `web_fetch` on the podcast episode page to extract the description/show notes.
   - Summarize from the show notes, but tell the user it's based on show notes, not a full transcript.

4. **If the podcast has an RSS feed URL**, parse it:

```bash
curl -s "RSS_FEED_URL" | grep -oP '<description><!\[CDATA\[.*?\]\]></description>' | head -5
```

5. Produce a structured summary:
   - **Podcast name** and **episode title**
   - **Key topics** (3–7 bullet points)
   - **Summary** (1–2 paragraphs)
   - **Source:** indicate whether the summary is from a transcript, show notes, or description.

**Important:** If no transcript or meaningful show notes can be found, tell the user clearly and suggest they provide a direct link to a transcript page or the audio file if they have a transcription tool.

---

## Output format

Always structure your summary clearly:

```
## 📝 Summary: [Title]

**Source:** [Article / YouTube Video / Podcast]
**URL:** [original URL]

### Key Points
- Point 1
- Point 2
- ...

### Summary
[1–2 paragraph summary]
```

## Language

- Detect the language of the source content and write the summary in the **same language**.
- If the user asks in French, answer in French regardless of source language.
- If the user explicitly asks for a different language, use that.

## Tips

- Always try `web_fetch` first for articles — it's the fastest path.
- For YouTube, try the `yt-dlp` method first if available, fall back to `curl` scraping.
- For podcasts, search for transcripts before resorting to show notes.
- If the content is very long, summarize in chunks and then synthesize.
- If the user says "transcribe" instead of "summarize", return the full transcript (cleaned up) rather than a summary.
