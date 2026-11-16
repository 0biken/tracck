---
name: resume-template
description: Use when the user wants to add a resume template to Tracck from an image or a written description. Reads the design, works out what each section is for and what each sample line does for the reader, writes the per-role samples with those intents, and adds the backend template, the frontend renderer and the tests. Trigger on "add a template", "port this resume design", "copy this CV style", or when a template image or description is shared. Do not use it to change an existing template's wording alone; edit its files directly.
---

# Resume template

A template is four things: the sections and what each is for, the personal details it shows,
one sample resume per role where every line says what it does, and a frontend renderer that
draws the same sections. This skill turns a design into all four and wires them in.

Read `backend/src/templates/template.ts` and `backend/src/templates/classic-red/` first. Classic
red is the reference: copy its shape, not its wording.

## Step 1: Read the design

Look at the image, or the description, from top to bottom. Write down:

- The section headings, in order, exactly as shown.
- What the header shows: which personal details, and in what order.
- Layout features (columns, rules, skill dots, dates aligned right). These go in the renderer
  only. They never go in a prompt.

If a section does not map to one of the five fixed section ids (`profile`, `experience`,
`education`, `skills`, `strengths`), stop and ask the user. Do not invent an id: the writer,
the formatter and the renderer all depend on these five.

## Step 2: Say what each section is for

For each section, write one sentence: what the reader gets from it, and what it must not do.
Name the evidence kinds it draws on, from the `EvidenceType` list in `backend/src/ai/ai-engine.ts`.

Good: "Profile: positions the person by their specialism and the proof of it. No tool lists."
Bad: "Profile: a short intro." (says nothing the writer can act on)

## Step 3: Write the samples, one per role

Six roles: `dev`, `devrel`, `smm`, `va`, `ux`, `da`. Each sample has 6 to 9 lines. Every line is
a `SampleLine`: `section`, `text`, `intent`.

- **text**: invented people, employers and figures, in the template's tone. Never real people.
- **intent**: one sentence naming the move this line makes for the reader. Say what the reader
  learns, and why the line is in that form. Example: "Shows the scale of the work before the
  result, so the reader can judge what the number means."
- Intents describe the move, never the sample's facts. A writer that copies the intent must
  still have to find real evidence.
- Each intent says something specific to its line. Do not reuse one intent across lines or roles.
- A role's sample covers the sections the template has, in the template's order, with
  experience lines written as a role heading followed by its bullets.

Check the result before moving on: read each intent and ask whether it names what the line does,
not what the line says.

## Step 4: Write the formatter rules

`rules.ts` holds only how to choose from the resume: which groups, how many skills and strengths,
and what counts as a strength. Do not repeat section purposes here; they already come from
`sections`. Keep it to about six lines.

## Step 5: Add the files

Backend, in `backend/src/templates/<id>/`:

- `index.ts`: the `TemplateDefinition`: id, name, description, `isDefault` (false for a new
  template), `previewPath`, `sections`, `details`, `formatterRules`, `samples`.
- `examples.ts`: the samples, built with a `line(section, text, intent)` helper as in classic red.
- `rules.ts`: the formatter rules.
- `preview.png`: the preview. Copy it from the image you were given. If there is no image,
  ask for one; do not leave the path pointing at nothing.

Then add the template to `TEMPLATES` in `backend/src/templates/registry.ts`.

Frontend:

- `frontend/src/components/resumes/templates/<id>.tsx`: a renderer taking `TemplateProps`. Read
  the header from `content.header.details` (labels and values, in order) and the groups from
  `content.layout`. Draw only the sections the template defines, using the same section ids.
- Register it in `TEMPLATE_RENDERERS` in `frontend/src/components/resumes/templates/index.ts`.

## Step 6: Check

Run, in `backend/`: `pnpm typecheck` and `pnpm test`. `templates.test.ts` fails if a section has
no purpose or evidence, or a sample line has no section or a short intent.

Run, in `frontend/`: `pnpm typecheck` and `pnpm lint`.

Then read the writer prompt for the new template: each section's purpose should appear once,
and each sample line should appear with its move. If a purpose appears twice, remove the copy
you do not need.

## What the user should check

- The section headings and their order match the design.
- The header details match the design, and only those are shown.
- The intents describe moves, and the samples contain no real names or figures.
- The preview looks right in the template picker.
