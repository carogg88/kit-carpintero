import { img, key, list, note, p, steps, table, tip, type Article } from './types';

/** Topic "Model tools": one step-by-step article per tool. Same structure as es-herramientas.ts. */
export const EN_TOOLS: Article[] = [
  {
    id: 'elegir',
    topic: 'herramientas',
    title: 'Select parts',
    summary: 'Tap a part to edit it, select several together and let go of them.',
    intro: [
      p('With **Select** you tap a part and the panel on the right becomes that part’s: its sizes, its position, the wood and its joints. It is the tool you start with and come back to after using any other.'),
      img('elegir', 'A selected leg: it is highlighted in the model and the panel shows its sizes'),
    ],
    sections: [
      {
        id: 'una',
        title: 'Select a part',
        blocks: [
          steps(
            'Tap **Select**, the first tool on the left.',
            'Tap the part in the model. It is highlighted in the accent color and its code, name and size appear at the top left.',
            'To let go of it, tap the background, press `Esc` or tap **See the whole piece** in the panel.',
          ),
          key('`V` picks this tool.'),
          tip('If the part is small or hidden behind another, pick it from the list at the top of the panel or from **Parts**, with no part selected.'),
        ],
      },
      {
        id: 'varias',
        title: 'Select several parts',
        blocks: [
          steps(
            'Tap the first part.',
            'Holding `Shift`, tap the others. On a phone, tap **Select several** and then each part.',
            'The panel shows the selected parts. From there you group them, change their sizes together, hide them or delete them.',
          ),
          img('elegir-varias', 'Two selected legs, with the selected parts panel'),
          p('To take a part out of the selection, tap it again with `Shift`. Learn more: [Group parts to move them together](grupo).'),
        ],
      },
      {
        id: 'grupos',
        title: 'Parts in a group',
        blocks: [
          list(
            'One tap on a part of a group selects the whole group.',
            'A second tap enters that part alone, to edit it.',
            'In the panel, the part says which group it belongs to and has **Select the group** to go back.',
          ),
        ],
      },
      {
        id: 'vista',
        title: 'Getting around the model',
        blocks: [
          list(
            'Drag the background to rotate the view.',
            'Use the mouse wheel, or two fingers on a phone, to zoom in or out.',
            'If you get lost, tap the fit button, next to Top.',
          ),
          p('Learn more: [Views and fit](vistas).'),
        ],
      },
    ],
    faq: [
      { q: 'I tap a part and another one gets selected, why?', a: 'The one in front gets selected. Rotate the view or pick it from the list at the top of the panel.' },
      { q: 'I tap a leg and all four get selected', a: 'They are in a group. Tap it again to select it alone.' },
    ],
    related: ['pantalla-editor', 'grupo', 'sola'],
  },
  {
    id: 'estirar',
    topic: 'herramientas',
    title: 'Stretch a part',
    summary: 'Drag a face to lengthen or shorten a part, and type the exact size.',
    intro: [
      p('**Stretch** changes one size of the part by dragging one of its faces: the face you touch moves and the opposite one stays put. Use it to lengthen a leg, widen a top or make an apron taller.'),
      img('estirar', 'Stretch picked, with the step guide at the bottom'),
    ],
    sections: [
      {
        id: 'arrastrar',
        title: 'Drag a face',
        blocks: [
          steps(
            'Tap **Stretch** in the toolbar.',
            'Put the pointer or your finger on the face you want to move.',
            'Drag outward to lengthen or inward to shorten. The new size shows next to it.',
            'Let go.',
          ),
          key('`P` picks this tool.'),
        ],
      },
      {
        id: 'exacta',
        title: 'Type the exact size',
        blocks: [
          steps('When you let go, a bubble shows the size it ended up with.', 'Type the size you want and press `Enter`.'),
          tip('To change a size without dragging, type it in **Finished dimensions**, in the part panel.'),
        ],
      },
      {
        id: 'mueble',
        title: 'Change the whole piece',
        blocks: [
          p('Stretch changes a single part. To make the whole piece wider or taller, use **Overall size**: long parts stretch and the rest move on their own.'),
          note('Learn more: [Change the size of the whole piece](medidas).'),
        ],
      },
    ],
    faq: [
      { q: 'Why does the face I touch not move?', a: 'The part may be very thin in that direction, or you may be touching another part. Select the part first and try from another view.' },
      { q: 'Can I stretch several parts at once?', a: 'Yes: select several and type the size in **Group size**, in the panel.' },
    ],
    related: ['mover', 'medidas', 'elegir'],
  },
  {
    id: 'mover',
    topic: 'herramientas',
    title: 'Move a part',
    summary: 'Take a part elsewhere, raise it, leave a copy and set the exact distance.',
    intro: [
      p('**Move** takes a part to another place in the piece. When you bring it close to another, it snaps to the edge or the center, and if they touch, the joint appears.'),
      img('mover', 'A leg just moved, with the bubble to type the distance'),
    ],
    sections: [
      {
        id: 'piso',
        title: 'Move along the floor',
        blocks: [
          steps(
            'Tap **Move** in the toolbar.',
            'In the 3D or Top view, drag the part. It moves across and front to back, without leaving the floor.',
            'While you drag it, you see how far it is from the neighboring parts.',
            'Drop it close to another: it snaps to the edge or the center and the face it rests on lights up.',
          ),
          key('`M` picks this tool.'),
        ],
      },
      {
        id: 'subir',
        title: 'Raise and lower',
        blocks: [
          steps('Switch to the **Front** or **Side** view.', 'Drag the part up or down. It does not go below the floor.'),
          tip('For an exact height, type it in **Position › From the floor**, in the panel. Learn more: [Raise or lower a part exactly](altura).'),
        ],
      },
      {
        id: 'exacta',
        title: 'Set the exact distance',
        blocks: [steps('When you let go, a bubble shows how far you moved the part.', 'Type the distance and press `Enter`. A tap without dragging also opens the bubble.')],
      },
      {
        id: 'copia',
        title: 'Leave a copy',
        blocks: [
          steps('In the guide at the bottom, tap **Leave a copy**.', 'Drag: the original part stays in place and the copy goes where you drop it.'),
          note('If the part is a component, the copy stays linked: what you change on one reaches the others. Learn more: [Make the twin leg on the other side](gemela).'),
        ],
      },
      {
        id: 'flechas',
        title: 'Nudge by the millimeter',
        blocks: [
          steps('With the part selected, use the keyboard arrows: each press moves it 1 mm, and with `Shift`, 10 mm.', 'The arrows follow the view: in Front they move across and up; in Top, across and front to back.'),
        ],
      },
    ],
    faq: [
      { q: 'Why does it not go up?', a: 'In 3D and Top the part stays on the floor. Switch to Front or Side.' },
      { q: 'A joint came apart when moving, what do I do?', a: 'If you separate two parts that were touching, the joint goes away. The notice at the bottom says so and has **Undo**.' },
      { q: 'Do the parts of a group move together?', a: 'Yes: dragging a part of a group moves the whole group.' },
    ],
    related: ['unir', 'altura', 'flechas', 'medir'],
  },
  {
    id: 'dibujar',
    topic: 'herramientas',
    title: 'Draw holes, pockets and through cuts',
    summary: 'Draw a rectangle, a circle, an arc or a freehand profile on a face and remove it from the part.',
    intro: [
      p('**Draw** removes material from a face: a **pocket** has a depth, like a notch or a rabbet, and a **through cut** goes all the way through, like a hole or a handle. You draw with a rectangle, a circle, an arc or a freehand profile.'),
      img('dibujar', 'A rectangle drawn on the apron, with the pocket or through cut bubble'),
    ],
    sections: [
      {
        id: 'cara',
        title: 'Pick the face',
        blocks: [
          steps('Tap **Draw** in the toolbar.', 'Tap the face of the part where you will draw. The view turns to face it and the face is marked.'),
          key('`D` picks this tool.'),
          tip('With the face picked, what you draw goes on that face even if another part is in front of it.'),
        ],
      },
      {
        id: 'figura',
        title: 'Draw the shape',
        blocks: [
          p('In the guide at the bottom, pick the shape:'),
          table(
            ['Shape', 'How to draw it'],
            ['Rectangle', 'Drag from one corner to the opposite one'],
            ['Circle', 'Drag from the center outward'],
            ['Arc', 'Drag from end to end, then tap how far it curves. Use it for an arched apron'],
            ['Freehand profile', 'Tap point by point. Use it for an edge with several curves, the outline of a leg or a shaped cutout'],
          ),
        ],
      },
      {
        id: 'perfil',
        title: 'Freehand profile',
        blocks: [
          p('The profile is a line of points you mark, with smooth curves between them. Depending on where it starts, it does two different things:'),
          img('perfil', 'A freehand profile on the apron: four points and the line following the pointer to the other edge'),
          table(
            ['You start', 'What it removes'],
            ['On an edge of the face', 'You finish by tapping another edge (or the same one) and it removes the smaller side: the curved edge of an apron, the outline of a leg, the shape of a backrest'],
            ['Inside the face', 'You close it by tapping the first point, which looks bigger, and it removes what is inside: a shaped cutout, like a handle or a heart'],
          ),
          steps(
            'In the guide, pick **Freehand profile**.',
            'Above the guide, pick whether the next point is a **Curve** or a **Corner**. You can change it between points.',
            'Tap the face point by point. With a mouse, the line follows the pointer so you can see how it looks.',
            'To fix a mistake, tap **Remove point** or press `Backspace`. `Esc` starts over.',
          ),
          tip('Fewer points give a smoother curve. For the outline of a cabriole leg, draw the profile on the front and the same one on the side.'),
          note('If the line crosses itself it can’t be cut: it turns red and you have to mark it again.'),
        ],
      },
      {
        id: 'burbuja',
        title: 'Pocket or through cut, and the sizes',
        blocks: [
          steps(
            'When you let go, a bubble appears. Pick **Pocket** or **Through cut**.',
            'For a pocket, type the **Depth**.',
            'Type the size (or the circle’s **Diameter**) and the distance to the edges, or tap **Center**.',
            'Tap **Done** in the guide when you are finished with that face.',
          ),
          note('If a through cut would take the whole part, the bubble warns you: make it smaller or change it to a pocket.'),
        ],
      },
      {
        id: 'editar',
        title: 'Change it later',
        blocks: [
          p('In the part panel, open **Pockets and through cuts**: each one has its sizes and a button to delete it.'),
          p('In a freehand profile, each point has its distance from the edges, a button to switch it between curve and corner, and one to delete it. **Remove the other side of the profile** keeps the small part and removes the big one.'),
        ],
      },
    ],
    faq: [
      { q: 'How do I make a notch for another part to fit in?', a: 'No need: when two parts cross, the joint already makes the cut. Only draw what is not a joint, like a hole or a handle.' },
      { q: 'The rectangle came out as a line', a: 'That happens when you drag along a single edge. Drag diagonally, from corner to corner.' },
      { q: 'How do I print the profile to trace it on the wood?', a: 'In **Plans**, the part with the profile has its 1:1 template. Tap **Print only the 1:1 template** (if there are several sheets, the button says how many), tape the sheet down and trace it.' },
    ],
    related: ['calado', 'biselar', 'elegir'],
  },
  {
    id: 'biselar',
    topic: 'herramientas',
    title: 'Bevel and round over',
    summary: 'A bevel, a rounded edge, a round corner or an angled cut on an edge.',
    intro: [
      p('**Bevel** cuts an edge of the part: straight (a bevel) or curved (a round-over). If the cut reaches the other side of the face, it is an angled cut; near a corner, it rounds the corner, as on a top.'),
      img('biselar', 'Bevel picked, with the two edge shapes in the guide'),
    ],
    sections: [
      {
        id: 'forma',
        title: 'Pick bevel or round-over',
        blocks: [
          steps('Tap **Bevel**. On a phone it is under **More**.', 'In the guide at the bottom, pick **Straight bevel** or **Round**.'),
          key('`B` picks this tool.'),
        ],
      },
      {
        id: 'arrastrar',
        title: 'Mark the edge',
        blocks: [
          steps(
            'Put the pointer on a face, close to the edge you want to cut.',
            'Drag into the face. Next to it you see how far the cut goes in.',
            'Let go and, if you want, type the exact size in the bubble.',
          ),
          list(
            'If you reach **the center** or **the full width**, the size snaps there. Full width makes an angled cut.',
            'Near a **corner**, it rounds or cuts the corner. If another corner already has a similar size, it matches it.',
          ),
        ],
      },
      {
        id: 'panel',
        title: 'Adjust it in the panel',
        blocks: [
          p('In the part panel, **Bevels, round-overs and angled cuts** shows each one. A bevel has how far it goes into each face and its angle; a round-over, its radius.'),
        ],
      },
      {
        id: 'cantos',
        title: 'Edges of the whole part',
        blocks: [p('To soften every edge of a part at once you do not need Bevel: in the panel, under **Shape › Edges**, pick **Rounded** or **Chamfered** and the size.')],
      },
    ],
    faq: [
      { q: 'I beveled one leg and they all got it', a: 'Matching legs are a component. To keep the bevel on the outside of each one, see [Bevel the legs on the outside](girada).' },
      { q: 'How do I delete it?', a: 'In the panel, under **Bevels, round-overs and angled cuts**, each one has its delete button. Or tap Undo right after.' },
    ],
    related: ['girada', 'tramo', 'dibujar'],
  },
  {
    id: 'tramo',
    topic: 'herramientas',
    title: 'Section: a thicker or thinner stretch',
    summary: 'Change the thickness of a leg or strip along part of its length.',
    intro: [
      p('**Section** gives part of a piece’s length a different cross-section: a thinner foot, a leg that is thicker at the top where the joints go, or a strip with a reduced stretch.'),
      img('tramo', 'A section marked on a leg, with its sizes in the panel'),
    ],
    sections: [
      {
        id: 'marcar',
        title: 'Mark the section',
        blocks: [
          steps(
            'Tap **Section**. On a phone it is under **More**.',
            'Put the pointer on the part where the section starts.',
            'Drag along the part to where it ends. Next to it you see from where to where it goes; it snaps at the ends.',
            'Let go. The section starts a bit thicker, so you can see it.',
          ),
          key('`T` picks this tool.'),
        ],
      },
      {
        id: 'medidas',
        title: 'Adjust the sizes',
        blocks: [
          steps(
            'In the part panel, open **Sections**.',
            'Type **From** and **To**: where it starts and ends, measured from one end.',
            'Type the two sizes of the cross-section: smaller than the part to slim it, larger to thicken it.',
          ),
          tip('The section stays centered on the part.'),
        ],
      },
    ],
    faq: [{ q: 'How do I delete it?', a: 'Under **Sections**, each section has its delete button.' }],
    related: ['tornear', 'biselar'],
  },
  {
    id: 'tornear',
    topic: 'herramientas',
    title: 'Turn a leg or a spindle',
    summary: 'Turn a long part into a turned one, from a model or with a custom profile.',
    intro: [
      p('**Turn** makes a long part, like a leg, into a turned part. It starts as a cylinder and its profile is built in the panel: a diameter at each distance.'),
      img('tornear', 'A turned leg, with the turning profile in the panel'),
    ],
    sections: [
      {
        id: 'empezar',
        title: 'Turn a part',
        blocks: [
          steps('Tap **Turn**. On a phone it is under **More**.', 'Tap a long part. It becomes a cylinder as thick as its blank.'),
          key('`R` picks this tool.'),
        ],
      },
      {
        id: 'modelo',
        title: 'Start from a model',
        blocks: [p('In the panel, under **Turning profile**, pick a model in **Start from a model**: Cylinder, Pedestal column, Table leg or Spindle. Then adjust it.')],
      },
      {
        id: 'estaciones',
        title: 'Adjust the profile',
        blocks: [
          p('The profile is a list of **stations**. Each one says how far from the end it is and what diameter it has.'),
          steps(
            'Change a station’s distance or diameter.',
            'Pick how it gets there from the previous one: **Straight**, **Bead (curves out)**, **Cove (curves in)** or **Stays square**, for the part where the joints go.',
            'With **Add station** you add another; each one can be deleted.',
          ),
          note('No diameter can be larger than the side of the blank.'),
        ],
      },
      {
        id: 'plantilla',
        title: 'Template for the lathe',
        blocks: [p('In the plans, every turned part comes with its 1:1 template to mark the stations on the blank.')],
      },
    ],
    faq: [{ q: 'How do I go back to the square part?', a: 'In the panel, tap **Remove turning**.' }],
    related: ['tramo', 'biselar'],
  },
  {
    id: 'medir',
    topic: 'herramientas',
    title: 'Measure between parts',
    summary: 'See how much room a part has on each side, the distance between two, and center it.',
    intro: [
      p('**Measure** tells you where a part sits in the piece and how far it is from another. If it ended up off-center, **Center** puts it in the middle.'),
      img('medir', 'Two legs measured, with the measurements card'),
    ],
    sections: [
      {
        id: 'una',
        title: 'Measure one part',
        blocks: [
          steps('Tap **Measure**. On a phone it is under **More**.', 'Tap a part: you see how much room it has on each side inside the piece.'),
          key('`C` picks this tool.'),
        ],
      },
      {
        id: 'dos',
        title: 'Measure between two parts',
        blocks: [
          steps('With one part measured, tap another.', 'You see how far apart they are across, up and front to back, and whether they touch, are apart or cross.'),
          tip('If you tapped two facing faces, you also see the distance between those faces.'),
        ],
      },
      {
        id: 'centrar',
        title: 'Center',
        blocks: [p('If the part ended up off-center, tap **Center** in the measurements card: it puts it in the middle in that direction. **Delete** starts over.')],
      },
    ],
    faq: [{ q: 'Does measuring change the selected part?', a: 'No: measuring does not change what is in the panel.' }],
    related: ['medir-centrar', 'mover'],
  },
  {
    id: 'rayos-x',
    topic: 'herramientas',
    title: 'X-ray',
    summary: 'See through the parts the joints that stay inside.',
    intro: [
      p('**X-ray** makes the parts see-through to show what stays inside, like the tenons in their mortises. It changes nothing in the piece.'),
      img('rayos-x', 'The table in X-ray: you can see the tenons inside the legs'),
    ],
    sections: [
      {
        id: 'usar',
        title: 'Turn it on and off',
        blocks: [
          steps('Tap **X-ray**, at the very bottom of the toolbar. On a phone it is under **More**.', 'Tap it again to turn it off.'),
          key('`X` turns X-ray on and off.'),
          tip('With X-ray on you can keep using the other tools.'),
        ],
      },
    ],
    related: ['cerca', 'vistas'],
  },
  {
    id: 'vistas',
    topic: 'herramientas',
    title: 'Views and fit',
    summary: 'Look at the piece in 3D, from the front, the side or the top, and fit it on screen.',
    intro: [p('Above the model are the views. They change where you look at the piece from, and some tools work differently depending on the view.'), img('editor-vistas', 'The view buttons, highlighted')],
    sections: [
      {
        id: 'cuatro',
        title: 'The four views',
        blocks: [
          table(
            ['View', 'What it is for'],
            ['3D', 'See the whole piece in perspective'],
            ['Front', 'Move parts across and up'],
            ['Side', 'Move parts front to back and up'],
            ['Top', 'Arrange parts on the floor, like a floor plan'],
          ),
        ],
      },
      {
        id: 'girar',
        title: 'Rotate, zoom and fit',
        blocks: [
          list(
            'Drag the background to rotate the view.',
            'Use the mouse wheel, or two fingers on a phone, to zoom in or out.',
            'The four-corners button fits the whole piece on screen.',
          ),
        ],
      },
      {
        id: 'panel',
        title: 'More room for the model',
        blocks: [p('The button next to the views folds the panel on the right. Tap it again to open it.')],
      },
    ],
    faq: [{ q: 'The keyboard arrows move the part the other way', a: 'They follow the view: in Front they move across and up; in Top, across and front to back.' }],
    related: ['mover', 'pantalla-editor'],
  },
];
