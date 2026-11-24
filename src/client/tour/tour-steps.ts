export interface TourStep {
  title: string;
  body: string;
  /** Where on the site the thing is, so a first-time visitor knows where to look. */
  where?: string;
}

/** The walkthrough, in the order a new person meets the parts of the app. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: 'Welcome to sraww',
    body: 'sraww is a whiteboard for drawing diagrams, with AI help and a way to map the structure of your code. Everything is stored on this computer. This tour takes about a minute, and you can open it again from the top of the main pages.',
  },
  {
    title: 'Drawings',
    body: 'Type a name and press Create to start a drawing, or import an .excalidraw file. Click a name to open it. Rename, duplicate and delete are beside each name.',
    where: 'Drawings tab, at the top of the list',
  },
  {
    title: 'Code projects',
    body: 'Upload a project folder or a zip file to draw its structure. Tick the privacy notice first. Dependency folders and build output are skipped. Credential files and binaries are left out, and the list shows each one with its reason.',
    where: 'Architecture tab, under “Code projects”',
  },
  {
    title: 'Architecture maps',
    body: 'Choose an uploaded project under “Map a project” and press “Map project”. The map groups the project into boxes you can move. Where you put them is saved for that map.',
    where: 'Architecture tab, under “Map a project”',
  },
  {
    title: 'The assistant',
    body: 'The assistant sits at the bottom of a drawing. In “Edit this drawing” it changes the drawing when you ask, and in “New diagram” it proposes a whole diagram that you can add or replace. Select shapes and press “Explain selection” to ask what they do.',
    where: 'Bottom of an open drawing',
  },
  {
    title: 'AI tools',
    body: 'The assistant uses the Claude Code or Codex command-line tool that you are already signed in to, so no API keys are needed. Sign in to each one and choose which one is the default here.',
    where: 'Top of the main pages, the “AI tools” tab',
  },
  {
    title: 'Your privacy',
    body: 'Drawings and uploaded code stay in the data folder on this computer. Name with AI sends each folder path, up to 15 file names per folder, and the other folders and packages it imports, with counts. Review with AI sends folder paths, folder labels, file and import counts, and computed findings. Neither sends file contents.',
    where: 'PRIVACY.md in the project',
  },
  {
    title: 'You are set',
    body: 'Start with a new drawing, or upload a project to map it. You can open this tour again at any time from “Take the tour” at the top of the main pages, or from the “Tour” button in a drawing.',
  },
];
