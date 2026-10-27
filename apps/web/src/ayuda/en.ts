import { EN_PARTS } from './en-piezas';
import { EN_REST } from './en-resto';
import { EN_TOOLS } from './en-herramientas';
import { img, key, list, note, p, steps, table, tip, type HelpContent } from './types';

/** Help Center in English: the same topics, articles and sections as es.ts. */
export const EN: HelpContent = {
  topics: [
    { id: 'empezar', icon: 'start', title: 'Getting started', summary: 'Create a project, get to know the editor screen and save your work.' },
    { id: 'herramientas', icon: 'tools', title: 'Model tools', summary: 'Step by step for every editor tool: select, stretch, move, draw, bevel, turn and more.' },
    { id: 'piezas', icon: 'parts', title: 'Parts and the whole piece', summary: 'The part panel, drawers and doors, copies, groups, overall size and the design review.' },
    { id: 'encastres', icon: 'joints', title: 'Joints', summary: 'The joint types, their sizes and how to see them up close.' },
    { id: 'compras', icon: 'cuts', title: 'Cuts and shopping', summary: 'The cut list, sheet goods, hardware and the budget.' },
    { id: 'plano-armado', icon: 'plans', title: 'Plans and assembly', summary: 'Printable plans, 1:1 templates, the assembly order and workshop mode.' },
    { id: 'compartir', icon: 'share', title: 'Share and export', summary: 'Send the project as a link and take it out as a file, spreadsheet or PDF.' },
    { id: 'como-hacer', icon: 'recipe', title: 'How to…', summary: 'Short recipes for what people look for most while building a piece.' },
    { id: 'atajos', icon: 'keys', title: 'Keyboard shortcuts', summary: 'Every editor key in one table.' },
  ],
  popular: ['crear-proyecto', 'pantalla-editor', 'mover', 'unir', 'estirar', 'guardar'],
  suggestions: ['Raise a part', 'Add a drawer', 'Save a backup', 'Inches'],
  articles: [
    {
      id: 'que-es',
      topic: 'empezar',
      title: 'What Calibre Studio is',
      summary: 'What the app is for and the path of a project, from design to assembly.',
      intro: [
        p('Calibre Studio is an app to design wooden furniture part by part. You build the piece in 3D, choose how the parts join, and the app gives you the cut list, the plans to print and the step-by-step assembly.'),
        img('inicio', 'The Calibre Studio home, with projects and templates'),
      ],
      sections: [
        {
          id: 'camino',
          title: 'The path of a project',
          blocks: [
            p('Every project has five parts, in the tabs at the top of the editor. You go through them in this order:'),
            steps(
              '**Model**: the piece in 3D. Here you add parts, change their sizes and place them.',
              '**Joints**: every joint between two parts, with its sizes. Joints appear on their own when two parts touch.',
              '**Cuts**: the list of parts to cut, which boards or sheets to buy, and the budget.',
              '**Plans**: the sheets to print, with the sizes of every part and the 1:1 templates.',
              '**Assembly**: the order to glue up and assemble the piece, step by step.',
            ),
            tip('In the tabs, a dot marks the next one and a tick the ones you’ve already seen.'),
          ],
        },
        {
          id: 'gratis',
          title: 'No account, on your device',
          blocks: [
            list(
              'You do not need an account and it costs nothing.',
              'Projects are saved only in this browser. Nothing is uploaded.',
              'Once open, the app works offline. If you install it, it opens like any other app.',
            ),
            note('Since projects live in the browser, save a copy to a file now and then. Learn more: [Save, open and back up](guardar).'),
          ],
        },
      ],
      faq: [
        { q: 'Do I need to know woodworking?', a: 'You do not need to be an expert: the app suggests common joints and sizes, and every workshop word has a ? button that explains it with a drawing.' },
        { q: 'Does it work for any piece of furniture?', a: 'It works for furniture made of straight parts: tables, benches, shelves, chests of drawers, boxes. Legs can be turned or have thinner sections.' },
      ],
      related: ['crear-proyecto', 'pantalla-editor', 'guardar'],
    },
    {
      id: 'crear-proyecto',
      topic: 'empezar',
      title: 'Create a project',
      summary: 'Start from a template, from a photo with sizes, or blank.',
      intro: [p('There are three ways to start a piece. The quickest is a template: it already has every part with its joints, and you only change the sizes.')],
      sections: [
        {
          id: 'plantilla',
          title: 'From a template',
          blocks: [
            steps(
              'On the home screen, tap **From a template** or one of the **Quick templates**.',
              'Choose the piece: table, stool, shelf, chest of drawers, bookcase, bench and more.',
              'Fill in the **Overall dimensions**. When you tap a size, the drawing marks which part of the piece changes.',
              'If you want, open **Parts** and **Wood and joints** to adjust thicknesses, the wood and the joint type.',
              'Tap **Create** and the piece opens in the editor.',
            ),
            img('plantilla', 'The Table template form, with the 3D drawing on the left'),
            tip('At the top right of the form you choose centimeters or inches.'),
          ],
        },
        {
          id: 'foto',
          title: 'From a photo',
          blocks: [
            p('Use it to copy a piece you saw: you trace the sizes over a photo. The photo stays on your device.'),
            steps(
              'On the home screen, tap **From a photo** and choose what piece it is.',
              'Choose or take the photo. Take it from the front, with the whole piece in it.',
              'Tap both ends of something whose size you know and type the size.',
              'Trace the other sizes by tapping two points for each.',
              'Tap **Review sizes**: the template opens with what you traced and you fill in what was not visible.',
            ),
            img('foto', 'The first step of New from photo'),
          ],
        },
        {
          id: 'blanco',
          title: 'Blank',
          blocks: [p('Opens the editor with no parts. You add each board or strip with **Add part**. Use it when the piece looks like no template.')],
        },
        {
          id: 'practica',
          title: 'To learn: the practice stool',
          blocks: [p('**Learn with a stool**, at the top of the home screen, builds a stool and shows you the editor with a 10-step guided tour.')],
        },
      ],
      faq: [
        { q: 'Can I change the sizes after creating the piece?', a: 'Yes. In the editor, with no part selected, open **Overall size**: long parts stretch and the rest move.' },
        { q: 'Which wood should I choose?', a: 'The template suggests one. In the form, **Wood** shows each one with its hardness; you can change it later part by part.' },
      ],
      related: ['pantalla-editor', 'medidas', 'que-es'],
    },
    {
      id: 'pantalla-editor',
      topic: 'empezar',
      title: 'The editor screen',
      summary: 'What is in each part of the editor: the top bar, the tools, the views and the panel.',
      intro: [
        p('The editor has four parts: the top bar, the tools on the left, the model with its views in the middle and the panel on the right. On a phone they are arranged differently, as shown at the end.'),
        img('editor', 'The editor with a table: top bar, tools, model and panel'),
      ],
      sections: [
        {
          id: 'barra',
          title: 'The top bar',
          blocks: [
            img('editor-barra', 'The editor top bar, highlighted'),
            p('From left to right:'),
            list(
              '**Logo and arrow**: go back home. The project is already saved.',
              '**Project name**: tap it to change it. Below it says whether it is saved.',
              '**Tabs**: Model, Joints (with the number of joints), Cuts, Plans and Assembly. A dot marks the next one and a tick the ones you’ve already seen.',
              '**?**: opens this Help Center.',
              '**Share**: a link with the project, the project as a file, or the shopping list as text.',
              '**Undo and Redo**: step back or forward through the last change.',
              '**cm and inches**: the units sizes are shown and typed in.',
            ),
          ],
        },
        {
          id: 'herramientas',
          title: 'The tools',
          blocks: [
            img('editor-herramientas', 'The toolbar, highlighted'),
            p('On the left, from top to bottom. Each one has its key:'),
            table(
              ['Tool', 'What it is for', 'Key'],
              ['Select', 'Tap a part to see it in the panel', '`V`'],
              ['Stretch', 'Drag a face to lengthen or shorten', '`P`'],
              ['Move', 'Take the part elsewhere; in Front or Side, raise it', '`M`'],
              ['Draw', 'Make holes, pockets and through cuts on a face', '`D`'],
              ['Bevel', 'A bevel or rounded edge on an edge', '`B`'],
              ['Section', 'A thicker or thinner stretch, like on a leg', '`T`'],
              ['Turn', 'Turned leg or spindle, with models', '`R`'],
              ['Measure', 'Distance between parts and whether one is centered', '`C`'],
              ['X-ray', 'See the joints inside through the parts', '`X`'],
            ),
            tip('When you pick a tool, a guide with its steps appears at the bottom.'),
          ],
        },
        {
          id: 'vistas',
          title: 'The model and the views',
          blocks: [
            img('editor-vistas', 'The view buttons, highlighted'),
            list(
              '**3D, Front, Side and Top** change where you look at the piece from.',
              'The four-corners button **fits** the whole piece if you get lost.',
              'Drag the background to rotate the view and use the mouse wheel (or two fingers) to zoom.',
              '**Select several**, at the top left, lets you pick several parts by tapping them.',
            ),
          ],
        },
        {
          id: 'panel',
          title: 'The panel',
          blocks: [
            img('editor-panel', 'The panel on the right, highlighted'),
            p('The panel changes with what is selected:'),
            list(
              '**Nothing selected**: the size of the whole piece, the design review, the golden ratio, the parts list and **Add part**.',
              '**A part selected**: its sizes, its position, Rotate 90°, the wood, the edges and its joints. At the bottom, Duplicate, Other side and Delete.',
            ),
            p('The button next to the views folds the panel to see the model larger.'),
          ],
        },
        {
          id: 'avisos',
          title: 'Notices and preview',
          blocks: [
            list(
              'After every change a notice of what changed appears at the bottom, with **Undo**.',
              'Big changes (furniture size, duplicate, delete, drawers) show a preview first: nothing changes until you tap **Apply**.',
            ),
          ],
        },
        {
          id: 'celular',
          title: 'On a phone',
          blocks: [
            img('editor-celular', 'The editor on a phone', true),
            list(
              'The tools are in a bar below the model. Bevel, Section, Turn, Measure and X-ray are under **More**.',
              'The tabs are in the bar at the very bottom.',
              'The panel sits below the model: swipe up to see it.',
              'The **+ Part** button adds a part.',
            ),
          ],
        },
      ],
      faq: [
        { q: 'How do I see the whole piece again?', a: 'Tap the fit button, next to Top, or **See the whole piece** in the panel to let go of the selected part.' },
        { q: 'A part disappeared, what happened?', a: 'It may be hidden. If parts are hidden, the view shows **Show all**. If you deleted it, tap Undo.' },
      ],
      related: ['atajos-teclado', 'crear-proyecto', 'deshacer'],
    },
    {
      id: 'guardar',
      topic: 'empezar',
      title: 'Save, open and back up',
      summary: 'Where projects are saved, how to save a copy to a file and how to open it.',
      intro: [p('Every change saves itself, in this browser. So you do not lose a project if the browser data is cleared, or to move it to another computer, save a copy to a file.')],
      sections: [
        {
          id: 'solo',
          title: 'It saves itself',
          blocks: [p('Below the project name it says **Saved on this device**. There is no save button: every change is saved right away.')],
        },
        {
          id: 'copia',
          title: 'Save a copy to a file',
          blocks: [
            steps(
              'On the home screen, find the project. Its tag says **No backup file**, **Changed since the backup** or **Backup up to date**.',
              'Tap **Save a backup**, or the project ⋮ menu and then **Export file**. With the project open, it’s also in **Share**.',
              'A file ending in .kitc.json downloads. Keep it wherever you like.',
            ),
            img('guardar', 'The ⋮ menu of a project, open'),
          ],
        },
        {
          id: 'abrir',
          title: 'Open a file',
          blocks: [steps('On the home screen, under Your projects, tap **Open file**.', 'Choose the .kitc.json file. The project opens in the editor and is saved in this browser.')],
        },
        {
          id: 'menu',
          title: 'Rename and delete',
          blocks: [
            p('Each project ⋮ menu also has **Rename**, **Go to the plans** and **Delete**.'),
            note('Delete cannot be undone. If you have a file copy, you can open it again.'),
          ],
        },
      ],
      faq: [
        { q: 'Can I continue the project on another computer?', a: 'Yes: save the file copy and open it on the other one with **Open file**. You can also send yourself the **Share** link.' },
        { q: 'Do I lose anything if I close the browser?', a: 'No. The only thing that deletes projects is clearing this site’s browsing data.' },
      ],
      related: ['nombre', 'que-es'],
    },
    {
      id: 'unidades',
      topic: 'empezar',
      title: 'Units and language',
      summary: 'Work in centimeters or inches, how to type sizes, and change the language.',
      intro: [p('Every project can be shown in centimeters or inches, and the app is in Spanish and English.')],
      sections: [
        {
          id: 'cm-pulgadas',
          title: 'Centimeters or inches',
          blocks: [
            steps('At the top right of the editor, tap **cm** or **inches**.', 'All sizes, cuts and the plans switch to that unit. Parts do not change size.'),
            img('unidades', 'The units switch in the top bar, highlighted'),
          ],
        },
        {
          id: 'escribir',
          title: 'How to type a size',
          blocks: [
            list(
              'In centimeters, with a comma or a point: **72,5** or **72.5**.',
              'In inches, with fractions: **2 7/8**, **3/4** or **1.5**.',
              'Press `Enter` to confirm. While you type, the model shows a ghost of how it will look.',
            ),
            tip('In inches, sizes round to 1/16″; in centimeters, to the millimeter.'),
          ],
        },
        {
          id: 'idioma',
          title: 'Change the language',
          blocks: [p('On the home screen, at the top right, tap **ES** or **EN**. The app reopens in that language.')],
        },
      ],
      faq: [{ q: 'Lumber is sold in inches, what is best?', a: 'You can design in centimeters: the cut list already says which board to buy, with its lumberyard sizes.' }],
      related: ['crear-proyecto', 'pantalla-editor'],
    },
    {
      id: 'instalar',
      topic: 'empezar',
      title: 'Install on your phone or computer',
      summary: 'Have Calibre Studio as one more app and use it offline.',
      intro: [p('Calibre Studio can be installed as an app. It opens from the desktop or the home screen, full screen and offline.')],
      sections: [
        {
          id: 'compu',
          title: 'On a computer or Android',
          blocks: [steps('Open Calibre Studio in Chrome or Edge.', 'On the home screen, tap **Install the app**. If it does not show, your browser does not allow it or it is already installed.')],
        },
        {
          id: 'iphone',
          title: 'On iPhone or iPad',
          blocks: [steps('Open Calibre Studio in Safari.', 'Tap Share and then **Add to Home Screen**.')],
        },
      ],
      faq: [{ q: 'Does the installed app have my projects?', a: 'Yes, if you installed it from the same browser where you created them.' }],
      related: ['guardar', 'que-es'],
    },
    ...EN_TOOLS,
    ...EN_PARTS,
    ...EN_REST,
    {
      id: 'atajos-teclado',
      topic: 'atajos',
      title: 'Keyboard shortcuts',
      summary: 'Every editor key: tools, parts, arrows and undo.',
      intro: [p('On a computer, almost the whole editor also works from the keyboard. Keys do nothing while you type in a field.')],
      sections: [
        {
          id: 'herramientas',
          title: 'Tools',
          blocks: [
            table(
              ['Key', 'What it does'],
              ['`V`', 'Select'],
              ['`P`', 'Stretch'],
              ['`M`', 'Move'],
              ['`D`', 'Draw'],
              ['`B`', 'Bevel'],
              ['`T`', 'Section'],
              ['`R`', 'Turn'],
              ['`C`', 'Measure'],
              ['`X`', 'X-ray (on and off)'],
            ),
          ],
        },
        {
          id: 'piezas',
          title: 'Parts',
          blocks: [
            table(
              ['Key', 'What it does'],
              ['`Shift` + click', 'Add or remove a part from the selection'],
              ['`G`', 'Group the selected parts'],
              ['`H`', 'Hide the selected part'],
              ['`S`', 'Show the selected part alone'],
              ['`Delete` or `Backspace`', 'Delete the selected part, with a preview'],
              ['`Esc`', 'Let go of the part, cancel the preview or leave what you are doing'],
            ),
          ],
        },
        {
          id: 'flechas',
          title: 'Nudge with the arrows',
          blocks: [
            table(['Key', 'What it does'], ['Arrows', 'Nudge the part or group 1 mm'], ['`Shift` + arrows', 'Nudge 10 mm']),
            p('The arrows follow the view: in Front they move across and up; in Top, across and front to back.'),
          ],
        },
        {
          id: 'deshacer',
          title: 'Undo and sizes',
          blocks: [
            table(['Key', 'What it does'], ['`Ctrl` + `Z`', 'Undo'], ['`Ctrl` + `Y` or `Ctrl` + `Shift` + `Z`', 'Redo'], ['`Enter`', 'Confirm the size you typed']),
            key('On a Mac, use `Cmd` instead of `Ctrl`.'),
          ],
        },
      ],
      related: ['pantalla-editor', 'flechas'],
    },
  ],
};
