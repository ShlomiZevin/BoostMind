Write a short script in Hebrew that Shlomi Zevin will READ ALOUD in a live conversation (Zoom/phone). He is presented as the AI expert on behalf of Telos (an IT company bidding on the government tender "המשך פיתוח מערכת עולים לענן", developed with Claude Code in spec-driven development). He needs to talk about his AI experience, mainly the AI-agent platform he built.

Facts (use only these):
- 20+ years building software, 50+ products from scratch. The last two-plus years deep in AI agents.
- He designed and built a platform for building AI agents, in production with real customers. Key idea: the agent does not answer from one big prompt. It thinks first: it pulls the important information from the conversation, decides on a strategy, applies fixed business rules wherever a rule can be stated, and only then answers. Common sense plus deep thinking, under control.
- Every agent has a written spec at every level; a built-in AI helper proposes changes, a person approves; versions and a separate publish step, so nothing reaches users by accident.
- Works with Claude, OpenAI and Gemini behind one routing layer; Hebrew; web and WhatsApp.
- On the same foundation: data agents for retail chains that answer business questions on real data (tens of millions of rows). Principle: the code does the arithmetic, the model does the judgment. Verified-correct figures went from 60 of 74 to 133 of 135.
- How he builds: Claude Code every day, spec first, then plan, implementation, tests, human review, and a separate release. Team of three. About 1,800 commits in about ten months.
- The platform is a customer's IP, so he speaks about the approach, not internal details. Do not name the platform or the customer.
- Close: this is exactly the way of working the tender asks for — he doesn't need to learn it, it's how he works every day.

Style: spoken Hebrew, first person, natural, confident and calm — like a senior person talking, not reading a brochure. Short sentences that are easy to say out loud. No marketing words, no superlatives, no English jargon beyond Claude Code / Spec / Claude / OpenAI / Gemini / WhatsApp. About 170–220 words. Short paragraphs separated by blank lines (each paragraph = one breath). 

After the script, add a line "אם שואלים:" and 3 short one-line answers (each starts with the question in bold, then the answer): **למה לא פרומפט אחד?** / **איך מונעים טעויות?** / **מה בדיוק אתה מביא לעולים לענן?**
Output only the script and the Q&A.
