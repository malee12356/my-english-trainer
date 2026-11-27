/**
 * Optional starter content (generic, non-confidential). Loaded only when the
 * user taps "Starter-Inhalte laden". Uses the public import format, so it goes
 * through exactly the same validation/duplicate pipeline as a ChatGPT import.
 */
import { BUSINESS_EXTRA, ENGINEERING_EXTRA, EVERYDAY_EXTRA, HANDBALL_EXTRA, MEETING_EXTRA } from './starterExtra';

type Raw = Record<string, unknown>;

const everyday: Raw[] = [
  { english: 'to be looking forward to something', german: 'sich auf etwas freuen', example_en: "I'm really looking forward to the weekend.", example_de: 'Ich freue mich sehr auf das Wochenende.', type: 'phrase', level: 'A2' },
  { english: 'to run errands', german: 'Besorgungen machen', example_en: 'I have to run a few errands after work.', example_de: 'Ich muss nach der Arbeit ein paar Besorgungen machen.', level: 'B1' },
  { english: 'In my opinion, …', german: 'Meiner Meinung nach …', alternatives_en: ['From my point of view, …', 'In my view, …'], type: 'phrase', level: 'A2' },
  { english: "I'm not really in the mood for it.", german: 'Ich habe nicht wirklich Lust darauf.', type: 'sentence', level: 'B1' },
  { english: 'to get on well with someone', german: 'sich gut mit jemandem verstehen', example_en: 'My kids get on well with their cousins.', example_de: 'Meine Kinder verstehen sich gut mit ihren Cousins.', level: 'B1' },
  { english: 'Could you recommend something?', german: 'Könnten Sie etwas empfehlen?', type: 'sentence', level: 'A2' },
  { english: 'to be exhausted', german: 'erschöpft sein', alternatives_en: ['to be worn out'], example_en: "After the long drive I'm completely exhausted.", example_de: 'Nach der langen Fahrt bin ich völlig erschöpft.', level: 'B1' },
  { english: 'It depends on the weather.', german: 'Es hängt vom Wetter ab.', type: 'sentence', level: 'A2' },
  { english: 'to book a table', german: 'einen Tisch reservieren', alternatives_en: ['to reserve a table'], level: 'A2' },
  { english: "That's a fair point.", german: 'Das ist ein berechtigter Einwand.', alternatives_de: ['Da ist was dran.'], type: 'sentence', level: 'B2' },
  { english: 'eventually', german: 'schließlich, letztendlich', common_mistake: "Using 'eventually' for German 'eventuell' (= possibly, maybe).", explanation: "'eventually' heißt 'schließlich', nicht 'eventuell'. 'Eventuell' = 'possibly' / 'maybe'.", type: 'word', level: 'B1' },
  { english: 'I was wondering if you could help me.', german: 'Ich wollte fragen, ob Sie mir helfen könnten.', type: 'sentence', level: 'B1' },
];

const business: Raw[] = [
  { english: 'to follow up on something', german: 'etwas nachverfolgen', example_en: "I'll follow up on this next week.", example_de: 'Ich verfolge das nächste Woche nach.', level: 'B1' },
  { english: 'Please find attached the report.', german: 'Anbei finden Sie den Bericht.', alternatives_en: ['Please find the report attached.', 'I have attached the report.'], type: 'sentence', level: 'B1' },
  { english: 'to meet a deadline', german: 'eine Frist einhalten', example_en: 'We will meet the deadline if nothing unexpected happens.', example_de: 'Wir halten die Frist ein, wenn nichts Unerwartetes passiert.', level: 'B1' },
  { english: 'to come up with a solution', german: 'eine Lösung finden', alternatives_en: ['to find a solution'], level: 'B1' },
  { english: 'The main issue is that …', german: 'Das Hauptproblem ist, dass …', type: 'phrase', level: 'B1' },
  { english: 'to prioritise', german: 'priorisieren', alternatives_en: ['to prioritize'], ipa: '/praɪˈɒrɪtaɪz/', level: 'B1' },
  { english: 'Could you give me a quick update on the status?', german: 'Könnten Sie mir kurz den aktuellen Stand geben?', type: 'sentence', level: 'B1' },
  { english: 'to make a decision', german: 'eine Entscheidung treffen', common_mistake: 'to do a decision', explanation: "Im Englischen 'make a decision', nicht 'do'.", type: 'correction', level: 'A2' },
  { english: 'to suggest an improvement', german: 'eine Verbesserung vorschlagen', example_en: "I'd like to suggest an improvement to the workflow.", example_de: 'Ich möchte eine Verbesserung des Ablaufs vorschlagen.', level: 'B1' },
  { english: 'responsibility', german: 'Verantwortung, Zuständigkeit', ipa: '/rɪˌspɒnsəˈbɪləti/', level: 'B1' },
  { english: 'I will get back to you by Friday.', german: 'Ich melde mich bis Freitag bei Ihnen.', type: 'sentence', level: 'B1' },
  { english: 'to be in charge of something', german: 'für etwas verantwortlich sein', alternatives_en: ['to be responsible for something'], level: 'B1' },
];

const engineering: Raw[] = [
  { english: 'The simulation results indicate that the maximum stress occurs near the contact area.', german: 'Die Simulationsergebnisse zeigen, dass die maximale Spannung in der Nähe des Kontaktbereichs auftritt.', type: 'sentence', level: 'B2', tags: ['FEM', 'results'] },
  { english: 'boundary conditions', german: 'Randbedingungen', example_en: 'We need to check the boundary conditions before we rerun the model.', example_de: 'Wir müssen die Randbedingungen prüfen, bevor wir das Modell erneut rechnen.', level: 'B2', tags: ['FEM'] },
  { english: 'mesh refinement', german: 'Netzverfeinerung', example_en: 'A local mesh refinement improved the stress results.', example_de: 'Eine lokale Netzverfeinerung hat die Spannungsergebnisse verbessert.', level: 'B2', tags: ['FEM', 'meshing'] },
  { english: 'The solution has not converged yet.', german: 'Die Lösung ist noch nicht konvergiert.', type: 'sentence', level: 'B2', tags: ['convergence'] },
  { english: 'stress', german: 'Spannung (mechanisch)', common_mistake: "Using 'tension' for every kind of mechanical stress.", explanation: "'stress' = Spannung allgemein; 'tension' = Zug(spannung).", type: 'word', level: 'B1', tags: ['mechanics'] },
  { english: 'strain', german: 'Dehnung', ipa: '/streɪn/', type: 'word', level: 'B2', tags: ['mechanics'] },
  { english: 'to validate the model against test data', german: 'das Modell mit Versuchsdaten validieren', level: 'B2', tags: ['validation'] },
  { english: 'The deformation is within the allowable limits.', german: 'Die Verformung liegt innerhalb der zulässigen Grenzen.', type: 'sentence', level: 'B2', tags: ['results'] },
  { english: 'contact definition', german: 'Kontaktdefinition', example_en: 'The contact definition between the two parts is frictional.', example_de: 'Die Kontaktdefinition zwischen den beiden Bauteilen ist reibungsbehaftet.', level: 'B2', tags: ['FEM', 'contact'] },
  { english: 'yield strength', german: 'Streckgrenze', ipa: '/jiːld streŋθ/', level: 'B2', tags: ['material'] },
  { english: 'design of experiments', german: 'Versuchsplanung', alternatives_en: ['DoE'], level: 'B2', tags: ['optimisation'] },
  { english: 'We assume linear elastic material behaviour.', german: 'Wir nehmen linear-elastisches Materialverhalten an.', alternatives_en: ['We assume linear elastic material behavior.'], type: 'sentence', level: 'B2', tags: ['material'] },
  { english: 'The results are sensitive to the mesh size.', german: 'Die Ergebnisse reagieren empfindlich auf die Netzgröße.', type: 'sentence', level: 'B2', tags: ['meshing'] },
  { english: 'root cause', german: 'Grundursache', example_en: 'We still need to identify the root cause of the failure.', example_de: 'Wir müssen die Grundursache des Versagens noch finden.', level: 'B2', tags: ['failure analysis'] },
];

const meeting: Raw[] = [
  { english: 'Could you clarify this point?', german: 'Könnten Sie diesen Punkt erläutern?', alternatives_en: ['Could you clarify that point?'], type: 'sentence', level: 'B1' },
  { english: 'From my point of view, …', german: 'Aus meiner Sicht …', alternatives_en: ['In my view, …', 'From my perspective, …'], type: 'phrase', level: 'B1' },
  { english: 'to take into account', german: 'berücksichtigen', example_en: 'We need to take this into account.', example_de: 'Wir müssen das berücksichtigen.', alternatives_en: ['to consider'], ipa: '/tə teɪk ˈɪntuː əˈkaʊnt/', level: 'B2' },
  { english: "I'm not entirely sure about that.", german: 'Da bin ich mir nicht ganz sicher.', type: 'sentence', level: 'B1' },
  { english: 'Let me explain the main issue.', german: 'Lassen Sie mich das Hauptproblem erklären.', type: 'sentence', level: 'B1' },
  { english: 'What would be the next step?', german: 'Was wäre der nächste Schritt?', type: 'sentence', level: 'A2' },
  { english: "Let's get started.", german: 'Lassen Sie uns anfangen.', alternatives_en: ["Let's start."], type: 'sentence', level: 'A2' },
  { english: 'I see your point, but …', german: 'Ich verstehe Ihren Standpunkt, aber …', type: 'phrase', level: 'B1' },
  { english: 'Sorry, I didn\'t quite catch that.', german: 'Entschuldigung, das habe ich nicht ganz verstanden.', type: 'sentence', level: 'B1' },
  { english: 'To sum up, …', german: 'Zusammenfassend …', alternatives_en: ['To summarise, …', 'To summarize, …'], type: 'phrase', level: 'B1' },
  { english: 'Who will take care of this?', german: 'Wer kümmert sich darum?', type: 'sentence', level: 'A2' },
  { english: 'I would like to share my screen.', german: 'Ich möchte meinen Bildschirm teilen.', type: 'sentence', level: 'A2' },
  { english: 'Could we move on to the next point?', german: 'Könnten wir zum nächsten Punkt übergehen?', type: 'sentence', level: 'B1' },
];

const handball: Raw[] = [
  { english: 'You need to create more space before attacking the gap.', german: 'Du musst mehr Raum schaffen, bevor du die Lücke angreifst.', type: 'sentence', level: 'B1', tags: ['attack'] },
  { english: 'Get back on defence!', german: 'Zurück in die Abwehr!', alternatives_en: ['Get back on defense!'], type: 'sentence', level: 'A2', tags: ['defence'] },
  { english: 'fast break', german: 'Tempogegenstoß', level: 'B1', tags: ['attack'] },
  { english: 'Well done, keep it up!', german: 'Gut gemacht, weiter so!', type: 'sentence', level: 'A2', tags: ['feedback'] },
  { english: 'Move your feet, not just your arms.', german: 'Beweg deine Füße, nicht nur die Arme.', type: 'sentence', level: 'B1', tags: ['defence'] },
  { english: 'warm-up', german: 'Aufwärmen', type: 'word', level: 'A2', tags: ['training'] },
  { english: 'Pass the ball earlier.', german: 'Spiel den Ball früher ab.', type: 'sentence', level: 'A2', tags: ['attack'] },
  { english: 'Talk to each other on defence.', german: 'Redet in der Abwehr miteinander.', type: 'sentence', level: 'B1', tags: ['defence', 'communication'] },
  { english: 'goalkeeper', german: 'Torwart, Torhüterin', type: 'word', level: 'A2' },
  { english: 'Everyone makes mistakes – what matters is how you react.', german: 'Jeder macht Fehler – entscheidend ist, wie du reagierst.', type: 'sentence', level: 'B1', tags: ['motivation'] },
  { english: 'Let\'s go through the drill once more.', german: 'Lasst uns die Übung noch einmal durchgehen.', type: 'sentence', level: 'B1', tags: ['training'] },
  { english: 'to substitute a player', german: 'einen Spieler auswechseln', level: 'B1', tags: ['coaching'] },
];

const withCat = (rows: Raw[], category: string) => rows.map((r) => ({ ...r, category, source: 'starter' }));

export const STARTER_CONTENT: Raw[] = [
  ...withCat([...everyday, ...EVERYDAY_EXTRA], 'Everyday English'),
  ...withCat([...business, ...BUSINESS_EXTRA], 'Business English'),
  ...withCat([...engineering, ...ENGINEERING_EXTRA], 'Engineering Mode'),
  ...withCat([...meeting, ...MEETING_EXTRA], 'Meeting Mode'),
  ...withCat([...handball, ...HANDBALL_EXTRA], 'Handball Mode'),
];
