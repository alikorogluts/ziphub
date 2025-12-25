ZipHub

ZipHub is a cross-platform desktop ZIP management application built with Next.js and Electron. The goal of this project is to combine a modern web-based UI with native desktop capabilities using a single codebase.

⸻

🚀 Getting Started

First, install the dependencies:

pnpm install

Start the Next.js development server:

pnpm dev

To run the Electron desktop application (in a separate terminal):

pnpm run electron

You can also view the web version in your browser:
👉 http://localhost:3000

⸻

🛠️ Project Structure
	•	app/ – Next.js App Router pages
	•	main.js – Electron main process
	•	public/ – Static assets
	•	package.json – Scripts and dependencies

To edit the main page:

app/page.tsx

Changes are reflected automatically during development.

⸻

🎨 Fonts & Optimization

This project uses next/font to automatically optimize and load the Geist font by Vercel.

Benefits:
	•	No external font requests
	•	Improved performance
	•	Better loading behavior

⸻

📚 Learn More

To learn more about the technologies used in this project:
	•	Next.js Documentation: https://nextjs.org/docs
	•	Learn Next.js: https://nextjs.org/learn
	•	Next.js GitHub Repository: https://github.com/vercel/next.js

⸻

📦 Build & Packaging (Electron)

To build the Next.js application:

pnpm run build

Electron packaging (e.g. .exe, .dmg) can be added later using electron-builder.

⸻

🌐 Deployment

For deploying the web version, Vercel is recommended:
	•	https://vercel.com/new

Desktop versions can be distributed separately as native installers.

⸻

✍️ Notes
	•	This project is intended for educational and personal development purposes
	•	pnpm is used as the package manager (npm/yarn are not recommended)

⸻

ZipHub – A modern desktop experience powered by Next.js and Electron