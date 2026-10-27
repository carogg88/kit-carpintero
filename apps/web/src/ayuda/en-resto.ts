import { img, list, note, p, steps, table, tip, type Article } from './types';

/** High-level topics in English: the same articles, sections and steps as es-resto.ts. */
export const EN_REST: Article[] = [
  {
    id: 'tipos-union',
    topic: 'encastres',
    title: 'Joint types',
    summary: 'Which joints the app offers, which one to use and which tools each one takes.',
    intro: [
      p('When two parts touch, the app proposes a joint and offers only the ones that can be made in that spot. **Joints** has them all, grouped by where they go: legs with aprons, shelves with sides, and so on.'),
      img('uniones', 'The Joints section: the list of groups on the left and the detail on the right'),
    ],
    sections: [
      {
        id: 'elegir',
        title: 'Change the type',
        blocks: [
          steps(
            'Go to **Joints**, in the tabs at the top, and pick a joint from the list.',
            'Under **Joint type**, tap **Change**.',
            'Pick one. The one marked **Recommended** suits those parts best; each one shows its difficulty, and the (i) shows a drawing and how it is made.',
          ),
          tip('You can also change it from the part panel, under **Joints**, with each row’s list.'),
        ],
      },
      {
        id: 'tipos',
        title: 'The joints',
        blocks: [
          table(
            ['Joint', 'Difficulty', 'Made with'],
            ['Butt joint', 'Easy', 'Screwdriver and clamps'],
            ['Dowels', 'Easy', 'Drill and dowel jig'],
            ['Pocket screw', 'Easy', 'Drill and pocket-hole jig'],
            ['Biscuit', 'Easy', 'Biscuit joiner'],
            ['Rabbet and dado', 'Easy', 'Router or table saw'],
            ['Half-lap', 'Medium', 'Handsaw and chisel, or router'],
            ['Tongue and groove', 'Medium', 'Tongue-and-groove bits or table saw'],
            ['Bridle joint', 'Medium', 'Band saw or table saw, and chisel'],
            ['Mortise and tenon', 'Medium', 'Mortiser or router, and a saw for the tenon'],
            ['Finger (box) joint', 'Medium', 'Table saw with a finger-joint jig'],
            ['Miter', 'Medium', 'Miter saw or tilted table saw'],
            ['Dovetail', 'Hard', 'Backsaw, chisel and sliding bevel'],
          ),
          note('A butt joint between two parts that cross is called **Resting in a notch**: one rests in a notch of the other.'),
        ],
      },
    ],
    faq: [
      { q: 'Why isn’t dovetail offered for a joint?', a: 'Only the joints that can be made with those parts in that position are offered.' },
      { q: 'Two parts touch and have no joint', a: 'Bring them together with Move until they really touch: the joint appears when the faces meet.' },
    ],
    related: ['medidas-union', 'encastre-cerca', 'unir'],
  },
  {
    id: 'medidas-union',
    topic: 'encastres',
    title: 'Sizes of one joint or the whole group',
    summary: 'Change the length, thickness or shoulder of a joint, on one joint or every joint in the group.',
    intro: [
      p('Each joint comes with sizes based on workshop rules, like the rule of thirds for tenons. If you want others, change them in the joint’s detail and see right away what changes in the cuts.'),
      img('uniones-medidas', 'A new tenon length, with the preview to apply it to the whole group'),
    ],
    sections: [
      {
        id: 'una',
        title: 'One joint',
        blocks: [
          steps(
            'In **Joints**, pick the joint.',
            'In the joint’s sizes, change the length, thickness, shoulder or count. While you type, the 3D detail shows the result.',
            'Below, **What changes in the cuts** says how much is added to each part’s cut length.',
          ),
          p('The note with the (i) recalls that joint’s rule: a tenon a third of the thickness, a dowel half, a 1:8 slope for tails.'),
        ],
      },
      {
        id: 'grupo',
        title: 'Every joint in the group',
        blocks: [
          steps(
            'Leave **Apply to all joints** of the group checked, at the bottom of the detail.',
            'Change the size or the type. A preview shows what changes.',
            'Tap **Apply to all…** with the count, or **Cancel**.',
          ),
          tip('That way a table’s four legs get the same tenons in a single change.'),
        ],
      },
    ],
    faq: [
      { q: 'A thick-tenon warning shows up', a: 'The tenon is over a third of the part’s thickness: the shoulders get thin. Bring it down to the size the warning says.' },
      { q: 'Does the change in the detail also show in the model?', a: 'Yes: the model, the cut list and the plans use the same sizes.' },
    ],
    related: ['uniones', 'tipos-union', 'revision'],
  },
  {
    id: 'encastre-cerca',
    topic: 'encastres',
    title: 'See a joint up close',
    summary: 'The 3D detail of a joint, with the parts together or apart.',
    intro: [
      p('Each joint’s detail shows both parts in 3D, with the receiving one in X-ray so you see the joint inside. **Pull apart** slides the tenon out of the mortise to show both halves.'),
      img('uniones-cerca', 'A tenon’s detail with the parts pulled apart'),
    ],
    sections: [
      {
        id: 'abrir',
        title: 'Open the detail',
        blocks: [
          list(
            'In **Joints**, pick a joint from the list.',
            'From the model: select a part, open **Joints** in its panel and tap the joint’s magnifier.',
          ),
        ],
      },
      {
        id: 'mirar',
        title: 'Look at it',
        blocks: [
          list(
            'Drag the detail to rotate it.',
            'Tap **Pull apart** to see them side by side, and **Put together** to go back.',
            'Pull apart stays on for the other joints while the app is open.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'The detail says the joint couldn’t be fully cut', a: 'Some size doesn’t fit in the part. Check the joint’s length and thickness.' },
      { q: 'Can I see the joints in the whole model?', a: 'Yes: turn on **X-ray** with the `X` key.' },
    ],
    related: ['cerca', 'rayos-x', 'medidas-union'],
  },
  {
    id: 'lista-cortes',
    topic: 'compras',
    title: 'Cut list and boards',
    summary: 'What to cut, which board each part comes from and what to buy at the lumber yard.',
    intro: [
      p('**Cuts** builds the list of parts with their cut size, tenons and tongues already added, and works out which boards to buy and how to cut each one. Sizes are the stock sizes of Buenos Aires lumber yards.'),
      img('cortes', 'The Cuts section: the parts list and the shopping summary'),
    ],
    sections: [
      {
        id: 'piezas',
        title: 'The parts list',
        blocks: [
          p('The **Parts** tab has one row per part (or per set of equal parts): code, quantity, **Cut length**, **Width × thickness**, wood and the work it takes, like tenons or tails at the ends.'),
          note('If a part is longer than the lumber yard’s boards (3.66 m), a warning says so: you need to splice it or order a special length.'),
        ],
      },
      {
        id: 'tablas',
        title: 'How to cut each board',
        blocks: [
          steps(
            'Tap the **How to cut** tab.',
            'Each board shows which parts come out of it and what is left over. Every cut already counts the saw kerf.',
          ),
        ],
      },
      {
        id: 'comprar',
        title: 'What to buy',
        blocks: [
          list(
            'On the right, **To buy at the lumber yard** says how many board feet, how many sheets and the waste.',
            'Below are the **Boards**, the **Sheets** and **Hardware and supplies**, each with its quantity.',
            'At the end, a note on each wood in the project and others that work.',
          ),
          tip('There is always waste: boards come in fixed lengths. Keep the offcuts to test your joints.'),
        ],
      },
    ],
    faq: [
      { q: 'What is a board foot?', a: 'The unit solid wood is sold in: a board 1 foot long, 1 foot wide and 1 inch thick. The (?) next to it explains it.' },
      { q: 'Are parts hidden in the model in the list?', a: 'Yes: the list always includes every part.' },
    ],
    related: ['comprar', 'placas', 'presupuesto'],
  },
  {
    id: 'placas',
    topic: 'compras',
    title: 'Sheets: MDF, melamine, plywood',
    summary: 'Make parts from sheet goods and know how many sheets to buy and how to cut them.',
    intro: [p('Besides solid wood, a part can be made of sheet goods: **MDF**, **White melamine**, **Plywood** or **Multi-ply**. Sheets come whole, in fixed thicknesses, and the app lays out how to cut them.')],
    sections: [
      {
        id: 'elegir',
        title: 'Make a part from a sheet',
        blocks: [
          steps('Select the part.', 'Under **Wood**, pick a sheet. The part takes the nearest sheet thickness.'),
          tip('The backs and drawer bottoms the app builds already use 9 mm plywood.'),
        ],
      },
      {
        id: 'cortar',
        title: 'How many sheets and how to cut them',
        blocks: [
          list(
            'In **Cuts**, the summary says how many sheets to buy.',
            'In **How to cut**, each sheet shows where each part goes, with the saw kerf and the edge trim already counted.',
            'The hardware list adds edge banding for visible edges.',
          ),
          note('Sheet shops cut to size and apply the edge banding: bring the exported spreadsheet, which includes the cutting layout.'),
        ],
      },
      {
        id: 'cual',
        title: 'Which one to use',
        blocks: [
          table(
            ['Sheet', 'What for'],
            ['MDF', 'Smooth and even, for painting or lacquering. Doesn’t like moisture.'],
            ['White melamine', 'Ready to use, with banding on the edges. Assembled with dowels or screws.'],
            ['Plywood', 'Light and stiff: backs and drawer bottoms.'],
            ['Multi-ply', 'Very stable, with a clean edge you can leave exposed.'],
          ),
        ],
      },
    ],
    faq: [
      { q: 'A warning says the part doesn’t fit on a sheet', a: 'It is bigger than a whole sheet, or thicker than the sheets you can get. Switch it to solid wood or make it smaller.' },
      { q: 'Can I mix sheets and solid wood?', a: 'Yes: each part has its own material, and Cuts separates what you buy at each shop.' },
    ],
    related: ['lista-cortes', 'panel-pieza', 'presupuesto'],
  },
  {
    id: 'herrajes',
    topic: 'compras',
    title: 'Hardware',
    summary: 'Screws, dowels, hinges, slides and everything else the piece needs.',
    intro: [p('The app adds what you need to buy besides the wood, based on the joints and what the piece has: dowels and biscuits for the joints, slides and pulls for the drawers, hinges for the doors, supports for the shelves, sandpaper and finish.')],
    sections: [
      {
        id: 'ver',
        title: 'Where the list is',
        blocks: [
          steps('Go to **Cuts**.', 'Open **Hardware and supplies** on the right (on a phone, below the shopping list).'),
          p('Each row says what it is and how many to get.'),
        ],
      },
      {
        id: 'de-donde',
        title: 'Where each item comes from',
        blocks: [
          table(
            ['What the piece has', 'What it adds'],
            ['Joints with dowels, biscuits or pocket screws', 'The dowels, biscuits or screws, with their size'],
            ['Drawers', 'Pulls and, if they are metal, slides of the right length'],
            ['Doors', 'Concealed hinges and pulls'],
            ['Adjustable shelves', '5 mm supports'],
            ['A tall piece that could tip over', 'Anti-tip brackets'],
            ['Sheets with visible edges', 'Edge banding'],
            ['The whole piece', 'Sandpaper and the finish that suits the wood'],
          ),
        ],
      },
    ],
    faq: [
      { q: 'Can I add hardware by hand?', a: 'Not yet. The list comes from the model: if you change a joint, the list changes with it.' },
      { q: 'Is it in the budget?', a: 'Yes: in **Budget** you enter the price of each item.' },
    ],
    related: ['presupuesto', 'cajones-puertas', 'lista-cortes'],
  },
  {
    id: 'presupuesto',
    topic: 'compras',
    title: 'Budget',
    summary: 'Enter prices and see what the piece costs, and what it would cost in another wood.',
    intro: [
      p('With your lumber yard’s prices, the budget works out what the piece costs: wood per board foot, sheets and hardware. Prices are saved on this device for your next projects.'),
      img('presupuesto', 'The Budget tab in Cuts'),
    ],
    sections: [
      {
        id: 'cargar',
        title: 'Enter the prices',
        blocks: [
          steps(
            'In **Cuts**, tap the **Budget** tab, or **Enter prices** in the summary on the right.',
            'Type the price per board foot of each wood, per sheet of each sheet and of each hardware item.',
            'The **Approximate total** updates with every price.',
          ),
        ],
      },
      {
        id: 'comparar',
        title: 'Compare with another wood',
        blocks: [
          steps(
            'Open **Compare wood prices**. It is optional.',
            'Enter the price per board foot of other woods: you see what this piece’s solid wood would cost in each one.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'Are prices shared with anyone?', a: 'No. They stay on this device; there is no server or account.' },
      { q: 'The total doesn’t show', a: 'It shows once you enter at least one price. While any are missing, the summary says **Enter prices**.' },
    ],
    related: ['lista-cortes', 'herrajes', 'comprar'],
  },
  {
    id: 'plano',
    topic: 'plano-armado',
    title: 'The plans and how to print them',
    summary: 'The plan sheets, the layers and how to save them as a PDF.',
    intro: [
      p('**Plans** draws the piece on landscape A4 sheets, with dimensions and scale, ready to print or carry on your phone. Each part has its code, the same as in the cut list and in Joints.'),
      img('plano', 'The Plans section: the list of sheets, the layers and the chosen sheet'),
    ],
    sections: [
      {
        id: 'hojas',
        title: 'The sheets',
        blocks: [
          table(
            ['Sheet', 'What it has'],
            ['General views', 'Front, side and top, with the piece’s dimensions'],
            ['The assembled piece', 'The piece in 3D, with each part’s code'],
            ['Parts', 'Every part, dimensioned'],
            ['Joints', 'Each joint type in detail'],
            ['1:1 templates', 'Curves and turning at full size, if the piece has them'],
          ),
          p('Tap a sheet in the list to see it. Zoom in with the zoom buttons, by pinching or with a double tap.'),
        ],
      },
      {
        id: 'capas',
        title: 'Layers',
        blocks: [p('Under **Layers** you turn outlines, dimensions, hidden lines, highlighted joints and notes on or off. It helps print a cleaner sheet.')],
      },
      {
        id: 'pdf',
        title: 'Save it as a PDF',
        blocks: [
          steps('Tap **Download PDF**.', 'The print window opens: choose **Save as PDF**.', 'All sheets come out on landscape A4.'),
          tip('From the home screen, each project’s ⋮ menu has **Go to the plans**.'),
        ],
      },
    ],
    faq: [
      { q: 'What does scale 1:10 mean?', a: 'That 1 cm on the sheet is 10 cm in real life. No need to measure the paper: the dimensions give the real size.' },
      { q: 'Do hidden parts show up in the plans?', a: 'Yes: the plans always include every part.' },
    ],
    related: ['plantillas', 'armado', 'exportar'],
  },
  {
    id: 'plantillas',
    topic: 'plano-armado',
    title: '1:1 templates',
    summary: 'Print curves, cutouts and turnings at full size to trace them onto the wood.',
    intro: [p('If a part has curves, cutouts or turning, the plans add full-size sheets: print them, cut them out and trace them onto the wood, no measuring.')],
    sections: [
      {
        id: 'imprimir',
        title: 'Print them',
        blocks: [
          steps(
            'In **Plans**, tap **Print only the 1:1 template** (if there are several sheets, the button says how many).',
            'Print at 100 %, without "fit to page".',
            'Measure the check bar on the sheet: it must be exactly 10 cm.',
          ),
          note('If the bar isn’t 10 cm, the printer shrank the sheet. Look for actual size or 100 % in the print options.'),
        ],
      },
      {
        id: 'usar',
        title: 'Use them',
        blocks: [
          list(
            'The hatched area is what comes off: trace the thick line.',
            'A part that doesn’t fit on one sheet comes on several: cut along the dotted line and tape each sheet over the previous one, matching the crosses.',
            'Turning comes with the profile and each station: set each diameter in its place with the calipers.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'I don’t see the templates button', a: 'It shows up when some part has curves, cutouts or turning.' },
      { q: 'A corner says it works for several', a: 'Equal corners share the template: turn the sheet for each one.' },
    ],
    related: ['plano', 'dibujar', 'tornear'],
  },
  {
    id: 'armado',
    topic: 'plano-armado',
    title: 'Step-by-step assembly',
    summary: 'The work order for the piece, from cut wood to finished piece.',
    intro: [
      p('**Assembly** gives you the work order for this piece: cut, mark, make the joints one type at a time, dry fit, sand, glue up and finish. Each step says which parts it involves.'),
      img('armado', 'The Assembly section, with the list of steps and the chosen step'),
    ],
    sections: [
      {
        id: 'usar',
        title: 'Follow the steps',
        blocks: [
          steps(
            'Go to **Assembly**, in the tabs at the top.',
            'Read the step and tap **Mark as done** when you finish it.',
            'Move on with **Next step**, or pick any step in the list.',
          ),
          p('At the top it says how many steps are done. It is remembered on this device, so you can carry on another day.'),
        ],
      },
      {
        id: 'pasos',
        title: 'The steps',
        blocks: [
          list(
            'Cut the pieces and, if needed, glue up the wide panels.',
            'Mark every piece with its code.',
            'One step per joint type, with the parts that take it.',
            'The other work: pockets, bevels, turnings.',
            'Dry fit, sand before gluing, glue up in stages.',
            'Sand everything and protect the wood.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'Does it change if I change the piece?', a: 'Yes: the steps come from the model, with its joints and parts.' },
      { q: 'Can I follow it on my phone in the workshop?', a: 'Yes, and to work piece by piece there is [Workshop mode](modo-taller).' },
    ],
    related: ['modo-taller', 'plano', 'tipos-union'],
  },
  {
    id: 'modo-taller',
    topic: 'plano-armado',
    title: 'Workshop mode on your phone',
    summary: 'One piece per screen, in large type, to keep your phone on the bench.',
    intro: [
      p('**Workshop mode** shows one piece per screen: its cut size in large type, a drawing with its joints and the steps to make it, with a check for each one. The screen stays on while you work.'),
      img('taller', 'Workshop mode on a phone', true),
    ],
    sections: [
      {
        id: 'abrir',
        title: 'Open it',
        blocks: [steps('Go to **Cuts** or **Assembly**.', 'Tap **Workshop mode**.')],
      },
      {
        id: 'usar',
        title: 'Use it',
        blocks: [
          list(
            'At the top it says which piece it is and how many you have done. Equal pieces go together, on one screen.',
            'Check each step when you finish it. Checks are saved on the phone.',
            'Move with **Next piece** and the back arrow, or tap **see all** at the top to jump to one.',
            'At the top right it says whether the screen stays on (**Screen on**) or **May turn off**. Tap it to change that.',
            'Leave with the ✕ at the top left.',
          ),
          tip('If there are several equal pieces, the step says so: do each step on all of them, or mirrored where needed.'),
        ],
      },
    ],
    faq: [
      { q: 'The screen turns off anyway', a: 'Some browsers don’t allow keeping it on; in that case, tapping the button says so.' },
      { q: 'Do I need internet in the workshop?', a: 'No, if you installed the app. Learn more: [Install on your phone or computer](instalar).' },
    ],
    related: ['armado', 'lista-cortes', 'instalar'],
  },
  {
    id: 'compartir-enlace',
    topic: 'compartir',
    title: 'Share as a link',
    summary: 'Send the project as a link, or the shopping list as text.',
    intro: [
      p('**Share** builds a link that carries the piece inside it: whoever opens it sees it and can save a copy to edit. No account needed, and nothing is uploaded anywhere.'),
      img('compartir', 'The Share window, with the link and the shopping list'),
    ],
    sections: [
      {
        id: 'enlace',
        title: 'Send the link',
        blocks: [
          steps(
            'In the editor, tap the share button at the top right.',
            'Tap **Copy link** (on a phone, **Share link**) and paste it into your message.',
          ),
          note('If the piece is large, the link is long. If an app cuts it off, send the backup file instead. Learn more: [Save, open and back up](guardar).'),
        ],
      },
      {
        id: 'abrir',
        title: 'Open a link someone sent you',
        blocks: [
          steps(
            'Open the link: you see the piece in 3D, with how many parts and joints it has.',
            'Tap **Save a copy and open it** to see all of it and edit it.',
          ),
          p('The copy stays on your device. Changes you make don’t reach whoever sent it.'),
        ],
      },
      {
        id: 'lista',
        title: 'Send the shopping list',
        blocks: [p('In the same window, **The shopping list, as text** has the boards, the sheets with their cutting layout and the hardware. Tap **Copy list** and send it to the lumber yard.')],
      },
    ],
    faq: [
      { q: 'Does whoever gets the link see my other projects?', a: 'No. The link carries only that project.' },
      { q: 'I changed the piece, does the link update?', a: 'No: it carries the piece as it was when you copied it. Send a new link.' },
    ],
    related: ['exportar', 'guardar', 'comprar'],
  },
  {
    id: 'exportar',
    topic: 'compartir',
    title: 'Export a file, spreadsheet or PDF',
    summary: 'The ways to take the project out of the app: file, cut spreadsheet and PDF plans.',
    intro: [p('Everything is saved in the browser, but sometimes you need to take it elsewhere: to another computer, to the lumber yard or to the printer.')],
    sections: [
      {
        id: 'que',
        title: 'What you can export',
        blocks: [
          table(
            ['What', 'Where', 'What for'],
            ['.kitc.json file', 'Home, the project’s ⋮ menu, or **Share** in the editor: **Export file**', 'A backup, or to carry on on another computer with **Open file**'],
            ['Cut spreadsheet (.csv)', 'Cuts, **Export spreadsheet**', 'Open it in Excel or Google Sheets, or take it to the sheet shop'],
            ['Plans as a PDF', 'Plans, **Download PDF**', 'Print it or keep it on your phone'],
            ['Shopping list as text', 'Share button, **Copy list**', 'Send it in a message'],
          ),
        ],
      },
      {
        id: 'planilla',
        title: 'The spreadsheet',
        blocks: [
          p('The spreadsheet has the cut list (part, quantity, length, width, thickness, wood and work), what to buy, the hardware and, if there are sheets, each sheet’s cutting layout in millimeters.'),
        ],
      },
    ],
    faq: [
      { q: 'How do I open the .kitc.json file?', a: 'On the home screen, under Your projects, tap **Open file**.' },
      { q: 'Can I edit the spreadsheet?', a: 'Yes, in any spreadsheet app. Changes there don’t come back to the app.' },
    ],
    related: ['guardar', 'plano', 'compartir-enlace'],
  },
];
