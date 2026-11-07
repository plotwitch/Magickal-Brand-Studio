# Magickal Brand Studio

An internal marketing tool for The Plot Witch. Magickal Brand Studio creates one master product image, locks the product's appearance, and derives every platform size from that approved master. The tool serves a two-person team: the shop owner and her AI agent, who operates the published app through a browser.

## The problem

Product images fall apart across platforms. A shop needs the same product on an Etsy listing, an Instagram portrait, a square post, a TikTok cover, and a Pinterest pin. A standard image generator invents the product fresh on every request. The box changes shape, the label text drifts, and the ribbon moves. Each image then needs its own round of judgment and correction, and a one-person shop pays that cost on every asset, every week.

## The method

Magickal Brand Studio treats product consistency as an architecture problem instead of a prompting problem.

1. **Canonical product specification.** A text model reads the product description and writes a locked specification: the object description, the silhouette, the surface materials, the label typography, and the lighting signature.
2. **Master anchor image.** The image model generates one master product image from the specification. The owner approves the anchor, or sends the anchor back. Nothing else generates before approval.
3. **Derivation.** Every platform size generates from the approved anchor image itself, passed back into the model as an input, with the locked specification attached. The product stays identical because the model works from the product, not from a description of the product.

The argument about how the product looks happens once, at the anchor. Every size after the anchor is production.

## Features

- Two-stage anchor system with an owner approval gate
- Exact platform sizes, rendered at exact pixels on export: Etsy listing 2700×2025, Instagram portrait 1080×1350, square 1080×1080, TikTok/Reel cover 1080×1920, Pinterest pin 1000×1500, hero 1920×1080
- Export filenames in the pattern `product_medium_size.png`
- Per-campaign people setting: product only, hands only, or a character in the scene from an uploaded reference image
- Saveable brand presets for colors and fonts
- Campaign mode for a product launch set, and Asset mode for one listing's weekly social assets
- Caption assistant that writes in the owner's voice from her voice guide, researches hashtags with live search, and selects 1 to 3 hashtags with verified post counts between 850,000 and 1,500,000
- A content calendar inside the app. Clicking a scheduled post opens the work screen with the product, size, and descriptions prefilled
- A single-password gate for the published app, checked on the server against a stored secret
- Server-side shared storage, so the owner and her agent see the same campaigns and the same calendar, with zip download and restore as a portable backup
- An interface built for two kinds of users: every control carries a text label and status appears as plain sentences, so an AI agent can drive the app reliably, and motion and small rewards keep the app pleasant for a person

## Style

The interface uses The Plot Witch tech-witch system: deep plum, vibrant teal, sassy magenta, and a black-night background, gold accents and thin gold borders, elegant serif display type for headings, and tarot-and-circuitry motifs in corners and dividers. Generated images appear as framed cards with gold borders. The layout stays clean and readable underneath the motion.

## Tech stack

React 19 and TypeScript, built with Vite and Tailwind CSS 4. An Express server holds the API routes. Image generation runs on Google's Nano Banana image model through the Gemini API. A Flash text model writes the canonical specification. The caption assistant runs on Gemini Argon with Flash as a fallback and Google Search grounding for hashtag research. Shared data lives in Firestore. The motion library drives card tilt, the anchor lock-in animation, and per-size generation progress.

## Run the app

The repository holds code only. Running the app takes a local setup and your own keys.

1. Clone the repository and run `npm install`.
2. Create a `.env` file with your own `GEMINI_API_KEY` and an `APP_PASSWORD` of your choice.
3. Run `npm run dev` and open the local address the server prints.
4. Enter the password you set, describe a product, approve the master anchor, and generate the sizes.

No keys ship with this repository. The published production copy stays private, because the production copy spends the owner's API credits.

## Screenshots

Step 1: create the master image. The owner picks a saved listing or describes a product, reuses a saved anchor or creates a fresh anchor, and approves the master. The approved master carries the gold seal.

![Step 1: master image approval](screenshots/01-master-image-approval.png)

Step 2 output: the derived size cards. Each card shows its platform, its exact pixel size, its status in plain words, and a link to compare the card against the master image.

![Derived size cards](screenshots/02-derived-size-cards.png)

Asset mode with the caption assistant. The assistant drafts the caption in the owner's voice and lists each researched hashtag with the count the search verified, or states plainly when a count did not verify.

![Asset mode with the caption assistant](screenshots/03-asset-mode-caption-assistant.png)

The content calendar, month view. Status shows as a plain label and a border color: drafted, ready, posted.

![Content calendar](screenshots/04-content-calendar.png)

The assistant's weekly schedule planner. The assistant proposes a week of posts in the owner's voice, and the owner approves or edits each post before the post lands on the calendar.

![Weekly schedule planner](screenshots/05-weekly-schedule-planner.png)

The scheduled post list. Each post carries an Open in Asset Mode button, and the button opens the work screen prefilled for that post.

![Scheduled posts with the jumpstart button](screenshots/06-scheduled-posts-jumpstart.png)

## Build record

Designed and directed by Tasha L. Driver (The Plot Witch), built with Google AI Studio as part of her Google AI Professional Certificate coursework in AI app building. The build ran in seven staged steps: the style system and plain-language interface copy, the Campaign and Asset modes, the motion and agent-friendly interface structure, the caption assistant, the content calendar, the password gate, and shared server-side storage. Each step shipped and was checked before the next step began.