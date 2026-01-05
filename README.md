# Social Media Police (SMP)

**Real-time AI & Misinformation Detection for Facebook**

Social Media Police is a Chrome Extension that integrates directly into your Facebook feed to analyze posts and comments for AI-generated content and misinformation. It uses advanced Large Language Models (LLMs) and heuristic analysis to provide a trust score for what you read.

## Features

*   **Seamless Integration**: Injects an "Analyze" button directly into the Facebook action bar (next to Like/Comment/Share).
*   **Real-time Analysis**: Uses `MutationObserver` to detect and process new posts as you scroll.
*   **Context Aware**: Intelligently scrapes original post context when analyzing comments to ensure accuracy.
*   **Non-intrusive UI**: Displays analysis results in an inline, easy-to-read overlay.
*   **User Dashboard**: Tracks analysis history and aggregates statistics (AI % and Misinformation rate) for specific users.

## How It Works

### The AI Engine
The extension employs a **Dual-Factor Scoring System** to determine the probability of AI generation:

1.  **Heuristic Score (50%)**: Code-based checks for specific patterns often found in AI writing (see below).
2.  **Model Intuition (50%)**: Uses LLMs (GPT, Claude, Gemini, or any model via Openrouter) to assess tone, flow, and reasoning.

It also performs a separate **Fact Check** to flag misleading or false information.

### Detection Heuristics
The heuristic engine scans for:
*   **Punctuation**: Overuse of em-dashes (—) and "perfect" grammar without human-like errors.
*   **Vocabulary**: "AI Words" like *delve, tapestry, leverage, transformative, crucial*.
*   **Structure**: The "Sandwich" structure (Intro -> Bullets -> Summary) and low burstiness (uniform sentence length).
*   **Tone**: Overly generic, motivational, or corporate "voice" lacking personal anecdotes.
*   **Consistency**: Unrealistic uniformity in style across multiple posts.

## Tech Stack

*   **Platform**: Chrome Extension (Manifest V3)
*   **Languages**: JavaScript (ES6+), HTML5, CSS3
*   **AI Providers**: OpenAI, Anthropic (Claude), Google (Gemini)

## Installation

1.  Clone this repository.
2.  Open Chrome and navigate to `chrome://extensions/`.
3.  Enable **Developer mode**.
4.  Click **Load unpacked** and select the extension directory.
5.  Pin the extension icon and configure your API keys in the popup.
