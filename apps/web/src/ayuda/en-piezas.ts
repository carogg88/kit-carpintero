import { img, key, list, note, p, steps, table, tip, type Article } from './types';

/** "Parts and the whole piece" topic in English: the same articles, sections and steps as es-piezas.ts. */
export const EN_PARTS: Article[] = [
  {
    id: 'panel-pieza',
    topic: 'piezas',
    title: 'The part panel',
    summary: 'Size, position, rotation, mirroring, wood, shape and joints of the selected part.',
    intro: [
      p('When you select a part, the panel on the right shows everything about it, top to bottom: which part it is, its size, where it is, its wood, its shape and which parts it joins. On a phone, the panel is below the model.'),
      img('panel-pieza', 'The panel of a selected leg, highlighted'),
    ],
    sections: [
      {
        id: 'arriba',
        title: 'At the top: which part it is',
        blocks: [
          list(
            'The list at the top switches parts without touching the model: handy for small or hidden parts.',
            'The two buttons next to it hide the part or show it alone. Learn more: [Hide and Show only](ocultar).',
            '**See the whole piece** deselects the part and goes back to the piece panel.',
            'Tap the name to change it. If the new name starts with another word, the code changes with it: a part renamed "Batten…" gets an L.',
          ),
          note('If the design review found something in this part, the warning shows up here, with what to do. Learn more: [Design review](revision).'),
        ],
      },
      {
        id: 'medidas',
        title: 'Size and position',
        blocks: [
          steps(
            'Under **Finished dimensions**, type the width, height or depth. While you type, the model shows a ghost of the result.',
            'Press `Enter` or tap outside the field to apply it.',
            'Under **Position**, type how far the part sits **From the floor**, **From the left** and **From the back**. That is how you raise or shift a part to an exact spot.',
          ),
          tip('Type in the project’s unit. In inches you can type fractions, like 2 7/8. Learn more: [Units and language](unidades).'),
          note('Finished dimensions are the part as assembled. Tenons, tails and tongues are added to the cut length on their own, in the cut list.'),
        ],
      },
      {
        id: 'girar',
        title: 'Rotate 90°',
        blocks: [
          table(
            ['Button', 'What it does'],
            ['**On the floor**', 'Turns the part a quarter turn resting as it is: what ran left to right now runs front to back.'],
            ['**Forward**', 'Tips it forward: the top goes to the front.'],
            ['**Sideways**', 'Tips it to one side: the top goes to a side.'],
          ),
          p('Pockets, bevels, sections and turning rotate with the part.'),
        ],
      },
      {
        id: 'espejar',
        title: 'Mirror',
        blocks: [
          p('**Mirror** flips the part as seen in a mirror, without moving it. What is drawn moves to the other side: a cutout near the left end ends up near the right end.'),
          table(
            ['Button', 'What it does'],
            ['**↔ Horizontal**', 'What was on the left moves to the right. Looking from the **Side**, it mirrors front to back.'],
            ['**↕ Vertical**', 'What was on top moves to the bottom.'],
          ),
          list(
            'Before it applies, the preview shows the result, with **Apply** and **Cancel**.',
            'Pockets, cutouts, freehand profiles, bevels, sections and turning go with the part. A leaning leg splays the other way.',
            'On a copy of a component only that copy is mirrored, just like rotating.',
            'With several parts or a group selected, they are mirrored together about the center of what they take up: each one flips and moves to its mirrored spot.',
          ),
          tip('To make a curved leg and get all four, draw the curve on one, use **Other side** for its twin and mirror the ones you need.'),
        ],
      },
      {
        id: 'inclinar',
        title: 'Lean the leg',
        blocks: [
          p('Legs and posts (upright parts) also have **Lean the leg**: the degrees **From the front** and **From the side** to splay it, like on a stool or a chair. Learn more: [Leaning legs](patas-inclinadas).'),
        ],
      },
      {
        id: 'madera',
        title: 'Wood',
        blocks: [
          p('Under **Wood** you pick a solid wood or a sheet (MDF, melamine, plywood or multi-ply). If you pick a sheet, the part takes the nearest sheet thickness, because sheets come in fixed thicknesses. Learn more: [Sheets](placas).'),
          p('Below it, **Grain** says which way the fibers run. It goes along the longest side of the part by itself, which is how the board is cut. On a top or a panel you can turn it the other way: the cut list then asks for the board with its length along the grain. It does not show for MDF or melamine, which have no grain.'),
          tip('If you turn the grain on a long, narrow part, like a slat or a leg, the design review warns **Short grain**: the part breaks easily that way.'),
          p('Further down, **Opens** says whether the part moves: as a **Drawer** (slides forward), a **Door** (swings on its hinge) or a **Lid** (lifts at the back). Drawers and doors made with the button already open by themselves; mark a hand-made part or group here, and the whole drawer or door changes together. On a door you pick which side the **Hinge** goes on: in a pair, each leaf opens to its own side. A marked door adds hinges to the hardware list.'),
        ],
      },
      {
        id: 'forma',
        title: 'Shape and joints',
        blocks: [
          list(
            '**Shape** has the edges (square, rounded or chamfered, and their size) and the list of the part’s pockets, bevels, sections and turning, each with its measurements to correct.',
            '**Add shape with the tools** goes straight to Draw, Bevel, Section or Turn.',
            '**Joints** lists every part this one touches. Change the joint there, and the magnifier opens it up close in Joints.',
          ),
          p('Both blocks fold so the panel fits on screen; the line under the title sums up what they hold.'),
        ],
      },
      {
        id: 'abajo',
        title: 'At the bottom: actions',
        blocks: [
          p('At the foot of the panel are **Duplicate**, **Other side**, **Make component** (or **Make unique**) and the trash can to delete the part. Learn more: [Duplicate, Other side and components](duplicar).'),
        ],
      },
    ],
    faq: [
      { q: 'I type a size and nothing changes', a: 'It applies when you press `Enter` or leave the field. If the number isn’t valid, the field says why.' },
      { q: 'Why don’t width, height and depth swap places when I rotate the part?', a: 'They always come in that order, named by direction: after rotating, width is still what it measures left to right.' },
    ],
    related: ['elegir', 'altura', 'medidas-mueble'],
  },
  {
    id: 'agregar-pieza',
    topic: 'piezas',
    title: 'Add parts',
    summary: 'Add a board, a batten or a panel, and take it where it goes.',
    intro: [
      p('A new part shows up resting on the floor, to the right of the piece, in the same wood as the project’s first part. It stays selected, ready to stretch to size and move into place.'),
      img('agregar-pieza', 'The Add part menu, open'),
    ],
    sections: [
      {
        id: 'agregar',
        title: 'Add a part',
        blocks: [
          steps(
            'With no part selected, tap **Add part** at the bottom of the panel. On a phone, tap **+ Part** over the model.',
            'Pick **Board**, **Batten** or **Panel**.',
            'Stretch it to size with [Stretch](estirar) or by typing in the panel.',
            'Take it where it goes with [Move](mover). When it touches another part, a joint is proposed.',
          ),
        ],
      },
      {
        id: 'cual',
        title: 'Which one to pick',
        blocks: [
          table(
            ['Part', 'Size when added', 'What for'],
            ['Board', '60 × 14.6 × 2.2 cm', 'Tops, sides, shelves and aprons'],
            ['Batten', '60 × 4.5 × 4.5 cm', 'Legs, rails and frames'],
            ['Panel', '60 × 40 × 1.8 cm', 'Backs, drawers and large tops'],
          ),
          tip('Once the piece has parts, the same menu offers **Drawer**, **Door** and **Shelves**, which build themselves in an opening. Learn more: [Drawers, doors and shelves](cajones-puertas).'),
        ],
      },
      {
        id: 'blanco',
        title: 'In a blank project',
        blocks: [p('A blank project shows the three parts in the middle of the view, to pick the first one. From there you can also go back to the templates.')],
      },
    ],
    faq: [
      { q: 'Where did the new part go?', a: 'To the right of the piece. If you can’t see it, tap the frame button next to the views.' },
      { q: 'Can I copy an existing part instead of adding a new one?', a: 'Yes: select it and tap **Duplicate**, or use **Leave a copy** with Move.' },
    ],
    related: ['crear-proyecto', 'estirar', 'mover'],
  },
  {
    id: 'cajones-puertas',
    topic: 'piezas',
    title: 'Drawers, doors and shelves',
    summary: 'Build drawers, doors or evenly spaced shelves in an opening of the piece, with their joints.',
    intro: [
      p('A drawer, a door or a set of shelves isn’t one part but several. The app builds them in an opening of the piece, with their sizes, their joints and the hardware they need.'),
      img('cajon', 'The Add drawer panel, with the piece’s openings numbered'),
    ],
    sections: [
      {
        id: 'hueco',
        title: 'Pick the opening',
        blocks: [
          steps(
            'With no part selected, tap **Add part** and pick **Drawer**, **Door** or **Shelves**.',
            'Under **Pick the opening** you see the front of the piece with the openings numbered. Tap the one it goes in. Below it says its size.',
            'While you choose, the model shows the opening highlighted and how the parts will look.',
          ),
          note('An opening is a space closed at the front, between two sides and two shelves (or the floor and the top). If the piece has none, you type the opening’s size and the drawer or door is built to the side, to move into place later. Shelves do need an opening.'),
        ],
      },
      {
        id: 'opciones',
        title: 'The options',
        blocks: [
          table(
            ['Option', 'What you choose'],
            ['**Quantity**', 'How many drawers or shelves (up to 8), or one or two doors. An opening wider than 60 cm starts with two doors.'],
            ['**Front**', '**Inset**: the front sits inside the opening, flush, with a 2 mm gap. **Overlay**: it covers the piece’s edges and is easier to fit.'],
            ['**Slides**', '**Wooden**: the drawer runs on the shelf, nothing to buy. **Metal**: telescopic, they take 12.5 mm per side.'],
            ['**Drawer heights**', '**Equal**, or **Graduated**: each one a bit shorter than the one below, in the golden ratio.'],
            ['Door **Type**', '**Solid board**, the simplest, or **Frame and panel**, with a panel floating in a groove so it doesn’t warp.'],
            ['Shelf **Type**', '**Fixed**, housed in a dado, or **Adjustable**, on 5 mm supports.'],
          ),
        ],
      },
      {
        id: 'agregar',
        title: 'Add them',
        blocks: [
          steps(
            'Below the options it says how many parts and joints it adds and the size of each front, door leaf or shelf.',
            'Tap **Add drawer** (or the matching button). The parts go into the opening and the first one is selected.',
          ),
          p('Drawer parts get the letter K and door parts get D. Slides, hinges, pulls and supports go to the shopping list on their own. Learn more: [Hardware](herrajes).'),
          p('If something doesn’t fit (an opening too low for that many drawers, for example), a warning says why and the button stays off.'),
        ],
      },
    ],
    faq: [
      { q: 'Can I change a drawer after adding it?', a: 'Its parts are regular parts: edit them one by one. To change the options, delete them and add it again.' },
      { q: 'Why isn’t Drawer in the menu?', a: 'It shows up once the piece has a part. In a blank project, add the carcass first.' },
    ],
    related: ['cajon', 'aurea', 'herrajes'],
  },
  {
    id: 'duplicar',
    topic: 'piezas',
    title: 'Duplicate, Other side and components',
    summary: 'Copy parts, make the twin on the other side and link copies so they change together.',
    intro: [p('A piece has many equal parts: four legs, two sides, two aprons. Instead of making each one, make one and copy it. If the copies are a component, whatever you change on one reaches them all.')],
    sections: [
      {
        id: 'duplicar',
        title: 'Duplicate',
        blocks: [
          steps(
            'Select the part and tap **Duplicate** at the bottom of the panel.',
            'The preview shows the copy to the right of the piece. Tap **Apply**.',
            'Take the copy where it goes with [Move](mover).',
          ),
          tip('To copy and drop the copy right where it goes, use **Leave a copy** with Move.'),
          img('duplicar', 'The Duplicate preview, with the copy as a ghost'),
        ],
      },
      {
        id: 'otro-lado',
        title: 'Other side',
        blocks: [
          steps(
            'Select the part that is already right: a leg, an apron, a side.',
            'Tap **Other side**. The preview shows the twin on the other side of the piece, at the same distance from the edge.',
            'Tap **Apply**.',
          ),
          p('The twin is mirrored and renames itself: left to right, front to back. If the part is in the middle of the piece, or there is already an equal one on the other side, a warning says so.'),
        ],
      },
      {
        id: 'componente',
        title: 'Components',
        blocks: [
          steps(
            'Select the part and tap **Make component**.',
            'Duplicate it, use Other side or leave copies with Move: all copies stay linked.',
            'Change the size, wood, edges or shape of any of them: it reaches them all.',
          ),
          p('A copy’s panel says which component it belongs to and how many copies it has. Position isn’t shared: each copy stays where it is.'),
          p('**Make unique** unlinks that copy: it stays the same, but what you change no longer reaches the others.'),
          note('In the templates, equal parts (a table’s legs, for example) already come as a component.'),
        ],
      },
    ],
    faq: [
      { q: 'I beveled a leg and the bevel ended up inside on the others', a: 'Rotate the right copy with Rotate 90°: it turns only that one, and from then on each one gets the bevel in its place. Learn more: [Rotated copies](copias-giradas).' },
      { q: 'How do I copy several parts at once?', a: 'Select them together (or select a group) and tap **Duplicate**. If they were a whole group, the copy is a new group.' },
    ],
    related: ['gemela', 'copias-giradas', 'grupos'],
  },
  {
    id: 'copias-giradas',
    topic: 'piezas',
    title: 'Rotated copies',
    summary: 'Component copies that are rotated or mirrored, and get every change in their place.',
    intro: [p('A table’s four legs are the same part, but they don’t all face the same way: the outer bevel of the left leg is on the opposite side from the right one. Rotated copies solve that: each copy knows how it is turned and gets changes in its place.')],
    sections: [
      {
        id: 'girar',
        title: 'Rotate a copy',
        blocks: [
          steps(
            'Select a copy of the component.',
            'Use **Rotate 90°** in the panel. It turns only that copy: the others stay as they are.',
            'The panel says so: **This copy is rotated or mirrored**.',
          ),
        ],
      },
      {
        id: 'cambios',
        title: 'Change the shape on any copy',
        blocks: [
          p('From then on, a new bevel, pocket or section on any copy reaches the others on the edge or face that matches theirs, not at the same spot in space.'),
          tip('**Other side** already makes the mirrored twin: no need to turn it by hand.'),
        ],
      },
      {
        id: 'ejemplo',
        title: 'Example: bevel the legs on the outside',
        blocks: [
          steps(
            'Make the front left leg the way you want it and turn it into a component.',
            'Make the others with **Other side** (left to right, then front to back).',
            'With **Bevel**, cut the outer edge of any leg: each one gets the bevel on its outer edge.',
          ),
        ],
      },
    ],
    faq: [
      { q: 'Does Rotate 90° turn every copy?', a: 'No: it turns only the selected copy. Size, wood and shape are still shared.' },
      { q: 'Can I stop sharing changes with a rotated copy?', a: 'Yes: **Make unique** unlinks it and leaves it as it is.' },
    ],
    related: ['girada', 'duplicar', 'biselar'],
  },
  {
    id: 'grupos',
    topic: 'piezas',
    title: 'Groups',
    summary: 'Put parts together to select, move, copy and resize them at once.',
    intro: [
      p('A group puts together parts that belong together, like a bench seat or a door frame. One tap selects the whole group, and it moves, copies, hides and deletes as one.'),
      img('grupo', 'A selected group, with its name and size in the panel'),
    ],
    sections: [
      {
        id: 'armar',
        title: 'Make a group',
        blocks: [
          steps(
            'Tap a part and then the others while holding `Shift`. On a phone, tap **Select several** and then each part.',
            'In the panel, tap **Group**.',
            'Tap the group’s name to change it.',
          ),
          key('With several parts selected, `G` groups them.'),
        ],
      },
      {
        id: 'usar',
        title: 'Use the group',
        blocks: [
          list(
            'One tap on any part of the group selects the whole group.',
            'With the group selected, Move and the arrow keys move all its parts together.',
            'Under **Group size** you change the width, height or depth of the whole group. Learn more: [Overall and group size](medidas-mueble).',
            '**Duplicate** makes a new group with the copies.',
            '**Mirror** flips the whole group as seen in a mirror, without moving it. Learn more: [The part panel](panel-pieza).',
            'Groups come first in the piece’s **Parts** list, with their eye to hide them.',
          ),
        ],
      },
      {
        id: 'una',
        title: 'Edit one part of the group',
        blocks: [
          steps('With the group selected, tap the part again: it gets selected alone.', 'Its panel says **Part of** and the group’s name, with **Select the group** to go back.'),
          p('**Ungroup** leaves the parts loose, where they are.'),
        ],
      },
    ],
    faq: [
      { q: 'Can a part be in two groups?', a: 'No. If you add it to a new group, it leaves the old one.' },
      { q: 'Does a group change the cuts or the plans?', a: 'No: it is only to work more comfortably in the model.' },
    ],
    related: ['grupo', 'elegir', 'medidas-mueble'],
  },
  {
    id: 'ocultar',
    topic: 'piezas',
    title: 'Hide and Show only',
    summary: 'Hide parts that get in the way, or leave one alone in the view to work on it.',
    intro: [
      p('To work on a part that sits inside the piece, like a rail or a drawer bottom, hide the parts in the way or leave that one alone in the view. Hiding doesn’t delete anything.'),
      img('ocultar', 'A leg alone in the view, with the notice to show everything'),
    ],
    sections: [
      {
        id: 'pieza',
        title: 'From the selected part',
        blocks: [
          steps(
            'Select the part.',
            'At the top of the panel, next to the name, tap the crossed-out eye to **Hide** it or the frame to **Show only** it.',
          ),
          key('`H` hides the selected part and `S` shows it alone. They also work with several parts or a group selected.'),
        ],
      },
      {
        id: 'lista',
        title: 'From the list',
        blocks: [p('With no part selected, in **Parts**, each part’s or group’s eye hides or shows it.')],
      },
      {
        id: 'volver',
        title: 'Show everything again',
        blocks: [p('While parts are hidden, the view shows a notice with how many. Tap **Show all** in that notice.')],
      },
    ],
    faq: [
      { q: 'Do hidden parts show up in the cuts and the plans?', a: 'Yes. Hiding is only for the model: the cuts, the plans and the assembly always include every part.' },
      { q: 'I opened the project and the parts I had hidden came back', a: 'That’s right: opening a project shows every part.' },
    ],
    related: ['sola', 'rayos-x', 'grupos'],
  },
  {
    id: 'medidas-mueble',
    topic: 'piezas',
    title: 'Overall and group size',
    summary: 'Change the width, height or depth of the whole piece, or a group, without redoing the parts.',
    intro: [
      p('With **Overall size** you resize everything: a 160 cm table becomes 180 cm by typing a number. Long parts in that direction stretch, the others move or spread out, and thicknesses don’t change.'),
      img('medidas-mueble', 'Overall size in the panel, with no part selected'),
    ],
    sections: [
      {
        id: 'mueble',
        title: 'The whole piece',
        blocks: [
          steps(
            'Tap **See the whole piece** to deselect the part.',
            'Open **Overall size** and type the width, height or depth. While you type, the model shows a ghost of the result.',
            'Press `Enter`. The preview says how many parts stretch and how many move.',
            'Tap **Apply**, or **Cancel** if it isn’t what you wanted.',
          ),
        ],
      },
      {
        id: 'grupo',
        title: 'A group',
        blocks: [
          steps(
            'Select the group, or several parts together.',
            'Under **Group size**, type the new size.',
            'Check the preview and tap **Apply**. The group’s parts stretch or move as if they were a separate piece; the rest doesn’t move.',
          ),
        ],
      },
      {
        id: 'que',
        title: 'What stretches and what moves',
        blocks: [
          list(
            'Long parts in that direction stretch: the top and the aprons when you change the width, the legs and sides when you change the height.',
            'Parts that touch move together as a block: the top with its aprons.',
            'The free space between blocks stretches evenly, so shelves stay evenly spaced.',
            'The top’s overhang past the legs doesn’t change.',
          ),
          note('If shrinking leaves no room between the parts, nothing changes and a warning says so. Shrink the part that doesn’t fit first.'),
        ],
      },
    ],
    faq: [
      { q: 'Are the joints redone?', a: 'Yes: tenons and the other joints follow the parts.' },
      { q: 'Why don’t I see Overall size?', a: 'It shows up with no part selected, once the piece has two parts or more.' },
    ],
    related: ['medidas', 'vista-previa', 'aurea'],
  },
  {
    id: 'vista-previa',
    topic: 'piezas',
    title: 'Preview, Apply and Undo',
    summary: 'See a big change before making it, and take back any change.',
    intro: [
      p('Big changes are shown before they happen: the model shows a ghost of the result and nothing changes until you tap **Apply**. Small changes apply right away, and any change can be undone.'),
      img('vista-previa', 'The preview bar, with Cancel and Apply'),
    ],
    sections: [
      {
        id: 'cuales',
        title: 'Which changes have a preview',
        blocks: [
          table(
            ['Change', 'How it shows'],
            ['Overall or group size, Duplicate, Other side and Delete', 'Preview with **Apply** and **Cancel**'],
            ['Applying sizes to every joint of a group, in Joints', 'Preview in the same panel, with what changes in the cuts'],
            ['A part’s size and position', 'Ghost while you type; applies with `Enter`'],
            ['Move, Stretch and the other tools', 'Shows while you drag; applies when you let go'],
          ),
        ],
      },
      {
        id: 'barra',
        title: 'The preview bar',
        blocks: [
          steps(
            'The bar appears below the model: what will happen and how many parts are new, change or get deleted.',
            'Tap **Apply** (or **Delete**, if it is a deletion) to do it.',
            'Tap **Cancel** to leave everything as it was.',
          ),
          key('`Enter` applies and `Esc` cancels.'),
        ],
      },
      {
        id: 'deshacer',
        title: 'Undo and redo',
        blocks: [
          list(
            'The **Undo** arrow at the top right takes back the last change. You can tap it several times.',
            '**Redo**, next to it, brings back what you undid.',
            'After a change, a notice at the bottom says what you did, with **Undo** at hand.',
          ),
          key('`Ctrl` + `Z` undoes; `Ctrl` + `Y` or `Ctrl` + `Shift` + `Z` redoes. On a Mac, with `Cmd`.'),
        ],
      },
    ],
    faq: [
      { q: 'How far back can I undo?', a: 'Everything since you opened the project. When you close it and open it again, it starts over.' },
      { q: 'Does Undo work in Joints or Cuts?', a: 'Yes, in every section of the project.' },
    ],
    related: ['deshacer', 'medidas-mueble', 'duplicar'],
  },
  {
    id: 'revision',
    topic: 'piezas',
    title: 'Design review',
    summary: 'Warnings about what an experienced woodworker would check before cutting.',
    intro: [
      p('The app checks the piece with every change and warns about what is worth fixing before cutting: where the problem is, why it happens and what to do. It doesn’t block anything: it is advice.'),
      img('revision', 'Design review open in the piece panel'),
    ],
    sections: [
      {
        id: 'ver',
        title: 'See the warnings',
        blocks: [
          steps(
            'With no part selected, open **Design review**. If there is nothing, it says **Nothing to fix**.',
            'Tap a warning to read it: what is going on and **What to do**.',
            'Tap **Show the piece** to go to the part.',
          ),
          p('Some warnings bring the fix in a button, for example **Use a 5.5 mm tenon** or **Thicken** the leg: you see it as a preview and confirm with **Apply**. **See it in the joint** takes you to Joints with the measurement to change marked.'),
          p('If you change a part’s thickness, tenons that were a third of the thickness follow the new thickness, and a notice at the bottom says so with **Undo**.'),
          p('If there are warnings, the model view shows **Review** with how many: one tap opens the list. And each part shows its own at the top of its panel.'),
        ],
      },
      {
        id: 'que',
        title: 'What it checks',
        blocks: [
          table(
            ['Warning', 'What it means'],
            ['Overlapping parts', 'Two parts take up the same space with no joint to explain it: it can’t be assembled like that.'],
            ['Could tip over', 'The piece is tall and shallow. Anti-tip brackets are added to the shopping list.'],
            ['Cross grain', 'A wide part glued to another that won’t let it move with humidity: it will crack.'],
            ['Mortise at the edge or thick tenon', 'Little wood is left around the mortise, or the tenon is over a third of the thickness.'],
            ['Wide tenon', 'The tenon is over 9 cm wide: it moves with humidity and weakens the leg. **Make a double tenon** splits it in two.'],
            ['Short grain', 'A long, narrow part with its grain turned across: it breaks. **Run the grain lengthwise** puts it back.'],
            ['Sagging shelves', 'Loaded with books, the shelf sags in the middle. It says which length or thickness avoids it.'],
          ),
        ],
      },
    ],
    faq: [
      { q: 'Do I have to fix every warning?', a: 'No. They are workshop advice: if you know why you are doing it that way, leave it.' },
      { q: 'I fixed the part and the warning is still there', a: 'The review is redone with every change. If it is still there, read **What to do**: sometimes another part has to move.' },
    ],
    related: ['rayos-x', 'tipos-union', 'aurea'],
  },
  {
    id: 'aurea',
    topic: 'piezas',
    title: 'Golden ratio',
    summary: 'A guide for balanced proportions, with one tap to take the piece there.',
    intro: [
      p('The golden ratio (φ ≈ 1.618) is a relation between two measurements that the eye finds balanced. Many cabinetmakers use it for the width and height of a piece, a table top or the drawers of a dresser. It is a guide, not a rule.'),
      img('aurea', 'Golden ratio open in the piece panel'),
    ],
    sections: [
      {
        id: 'ver',
        title: 'See the proportions',
        blocks: [
          steps(
            'With no part selected, open **Golden ratio**. Next to the title it says how many are already golden.',
            'Each row compares two measurements: **Front** (width and height), **Top** (width and depth) and, if there are any, the **Drawers**.',
            'The drawing shows the rectangle as it is and, dotted, the nearest golden one.',
          ),
          table(['Mark', 'Means'], ['**Golden**', 'Already follows the ratio.'], ['**Close**', 'A small tweak gets it there.'], ['**Off**', 'It is far. It may be fine as it is.']),
        ],
      },
      {
        id: 'llevar',
        title: 'Take the piece to the ratio',
        blocks: [
          steps('Tap the button with the proposed size, for example **Width to 162 cm**.', 'The piece changes as with Overall size: long parts stretch and the others move.'),
          note('For tables, stools, benches and nightstands the height isn’t proposed: the body sets it there.'),
          tip('**Graduate them to the golden ratio** leaves each drawer a bit shorter than the one below. You can also pick it when adding the drawers.'),
        ],
      },
    ],
    faq: [
      { q: 'Mine says Close, is that wrong?', a: 'No. The ratio is a design guide; the sizes you need come first.' },
      { q: 'Can I undo it?', a: 'Yes, like any change: with the Undo arrow or `Ctrl` + `Z`.' },
    ],
    related: ['medidas-mueble', 'cajones-puertas', 'revision'],
  },
  {
    id: 'patas-inclinadas',
    topic: 'piezas',
    title: 'Leaning legs: stools, benches and chairs',
    summary: 'Splay the legs or rake a chair back, with the angles for the bevel gauge.',
    intro: [
      p('A leaning leg opens outward, like on a rustic stool or a chair: the piece stands firmer and doesn’t tip over. The app leans the leg, cuts its ends level so it sits flat on the floor and under the seat, and makes the rungs follow it. In Cuts, the Plans and Workshop mode it gives you the angle to mark with the bevel gauge.'),
      img('patas-inclinadas', 'A chair with the front leg selected and Lean the leg in the panel'),
    ],
    sections: [
      {
        id: 'plantillas',
        title: 'Start from a template',
        blocks: [
          p('Three templates already come with leaning legs and all their joints:'),
          table(
            ['Template', 'What you choose'],
            ['**Splayed-leg stool**', 'The leg splay, from 4° to 12°, and whether it has rungs'],
            ['**Rustic bench**', 'The sideways and lengthwise splay, separately, and rungs at the ends or also along the length'],
            ['**Chair**', 'The leg splay, how far the back rakes, and whether the back has one or two rails'],
          ),
          img('plantilla-silla', 'The Chair template form, with the back rake and the leg splay'),
          tip('6° to 8° of splay is typical: you can see it and the piece stands firm. Past 10°, the legs take up a lot of floor.'),
        ],
      },
      {
        id: 'inclinar',
        title: 'Lean a leg',
        blocks: [
          steps(
            'Select the leg. It has to be an upright part (taller than it is wide and deep) and not turned.',
            'In the panel, below **Rotate 90°**, find **Lean the leg**.',
            'Type the degrees **From the front** and **From the side**. Positive: the bottom end moves right (from the front) or forward (from the side).',
            'Press `Enter`. The leg pivots on its top end, which stays where it was, and both ends are cut level.',
          ),
          tip('For the four legs to open toward their corners, the left one takes a negative number and the right one a positive: -6 and 6. With 0 and 0 the leg stands straight again.'),
          note('The part’s sizes are still those of the straight leg: **Height** is how tall the leaning leg stands. The length to cut it is in Cuts.'),
        ],
      },
      {
        id: 'travesanos',
        title: 'Rungs and aprons',
        blocks: [
          p('A rung or apron between leaning legs looks straight in the panel, but when it is cut it follows the legs: it shifts with them, stretches to each leg’s face and its shoulders come out angled. The tenon stays straight, along the rung.'),
          list(
            '**Mortise and tenon** and **Butt joint** follow the leg. With any other type, the detail warns that the joint does not follow the leaning leg yet.',
            'The seat mortises move to where the leg really lands, and their note says they slant and what to set the bevel gauge to for guiding the chisel.',
            'In Joints, the 3D detail shows the parts where they really sit, leaning, and pulling them apart opens them along the leg.',
          ),
        ],
      },
      {
        id: 'angulos',
        title: 'The angles to mark',
        blocks: [
          p('A **bevel gauge** is a square that locks at any angle: you mark the ends and shoulders with it. The app always gives you the angle to set it to, measured between the part’s edge and the end.'),
          img('patas-cortes', 'The chair’s cut list: the legs with ends cut parallel and the bevel gauge at 84°'),
          table(
            ['Where', 'What it says'],
            ['**Cuts**', 'In **Work**, for example: “ends cut parallel, at 6°: set the bevel gauge to 84° from the edge”. The cut length runs from long point to long point.'],
            ['**Plans**', 'The parts sheet draws the leg straight, lengthwise, with an arc and its angle at each end. Rungs show the angle of their shoulders.'],
            ['**Workshop mode**', 'Each part shows the same angles, in large type.'],
          ),
          img('patas-plano', 'The chair’s parts sheet in the plans, with the angles at the ends of the legs and rungs'),
          tip('Measure the cut length along the part’s longest edge: the long point.'),
        ],
      },
    ],
    faq: [
      { q: 'Can I lean a lying rail or a board?', a: 'No: only upright parts lean, like legs and posts. If you don’t see **Lean the leg**, the part is lying down or turned.' },
      { q: 'Why does the chair back lean back instead of splaying?', a: 'The back posts lean only **From the side**, so your back rests comfortably. Change it with **Back rake** when you create the chair, or in each post’s panel.' },
      { q: 'I changed the lean: do I have to lengthen the rungs?', a: 'No: when it is cut, the rung stretches or shortens to the legs on its own. The cut list already has the new length.' },
    ],
    related: ['panel-pieza', 'tipos-union', 'lista-cortes', 'plano'],
  },
];
