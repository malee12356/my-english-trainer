/**
 * Default vocabulary for school years 7–8 (A2–B1) and 9–10 (B1–B2).
 * Generic school-book vocabulary, no personal data. Public import format.
 */
type Raw = Record<string, unknown>;

const school78: Raw[] = [
  { english: 'to revise for a test', german: 'für einen Test lernen / wiederholen', example_en: 'I need to revise for my English test.', example_de: 'Ich muss für meinen Englischtest lernen.', level: 'A2' },
  { english: 'to get a good mark', german: 'eine gute Note bekommen', alternatives_en: ['to get a good grade'], level: 'A2' },
  { english: 'report', german: 'Zeugnis', alternatives_en: ['school report'], type: 'word', level: 'A2' },
  { english: 'to make a mistake', german: 'einen Fehler machen', common_mistake: 'to do a mistake', type: 'correction', level: 'A2' },
  { english: 'to pay attention', german: 'aufpassen', example_en: 'Please pay attention to the instructions.', example_de: 'Bitte achtet auf die Anweisungen.', level: 'A2' },
  { english: 'I think that …', german: 'Ich denke, dass …', alternatives_en: ['I believe that …'], type: 'phrase', level: 'A2' },
  { english: 'In my opinion, school should start later.', german: 'Meiner Meinung nach sollte die Schule später anfangen.', type: 'sentence', level: 'B1' },
  { english: 'school trip', german: 'Klassenfahrt, Schulausflug', type: 'word', level: 'A2' },
  { english: 'presentation', german: 'Referat, Präsentation', example_en: 'I have to give a presentation on Monday.', example_de: 'Ich muss am Montag ein Referat halten.', type: 'word', level: 'A2' },
  { english: 'I have already finished my homework.', german: 'Ich habe meine Hausaufgaben schon fertig.', explanation: "Present perfect mit 'already' – die Handlung ist abgeschlossen, wichtig ist das Ergebnis jetzt.", type: 'sentence', level: 'A2' },
  { english: 'Yesterday we wrote a test.', german: 'Gestern haben wir einen Test geschrieben.', explanation: "Mit 'yesterday' steht das simple past, nicht das present perfect.", type: 'sentence', level: 'A2' },
  { english: 'to be good at something', german: 'gut in etwas sein', example_en: 'She is good at Maths.', example_de: 'Sie ist gut in Mathe.', level: 'A2' },
  { english: 'compulsory', german: 'verpflichtend, Pflicht-', type: 'word', level: 'B1' },
  { english: 'timetable change', german: 'Vertretungsplan / Stundenplanänderung', level: 'B1' },
  { english: 'to look something up', german: 'etwas nachschlagen', example_en: 'Look the word up in the dictionary.', example_de: 'Schlag das Wort im Wörterbuch nach.', level: 'A2' },
];

const family78: Raw[] = [
  { english: 'to get on well with someone', german: 'sich gut mit jemandem verstehen', level: 'A2' },
  { english: 'to argue', german: 'sich streiten', example_en: 'My brother and I sometimes argue.', example_de: 'Mein Bruder und ich streiten uns manchmal.', type: 'word', level: 'A2' },
  { english: 'to be allowed to', german: 'dürfen', example_en: "I'm not allowed to stay out late.", example_de: 'Ich darf nicht lange wegbleiben.', level: 'A2' },
  { english: 'pocket money', german: 'Taschengeld', type: 'word', level: 'A2' },
  { english: 'to be proud of someone', german: 'stolz auf jemanden sein', level: 'A2' },
  { english: 'relationship', german: 'Beziehung', type: 'word', level: 'B1' },
  { english: 'to trust someone', german: 'jemandem vertrauen', level: 'A2' },
  { english: 'lonely', german: 'einsam', type: 'word', level: 'A2' },
  { english: 'jealous', german: 'eifersüchtig, neidisch', type: 'word', level: 'B1' },
  { english: 'I feel nervous before tests.', german: 'Vor Tests bin ich nervös.', type: 'sentence', level: 'A2' },
  { english: 'to look after a pet', german: 'sich um ein Haustier kümmern', level: 'A2' },
  { english: 'endangered animals', german: 'bedrohte Tierarten', level: 'B1' },
  { english: 'to apologise', german: 'sich entschuldigen', alternatives_en: ['to apologize'], level: 'A2' },
  { english: 'He is taller than his sister.', german: 'Er ist größer als seine Schwester.', explanation: "Steigerung: tall – taller – the tallest; 'als' = 'than'.", type: 'sentence', level: 'A2' },
  { english: 'my best friend', german: 'mein bester Freund / meine beste Freundin', level: 'A1' },
];

const daily78: Raw[] = [
  { english: 'to go shopping', german: 'einkaufen gehen', level: 'A2' },
  { english: 'How much is it?', german: 'Wie viel kostet das?', alternatives_en: ['How much does it cost?'], type: 'sentence', level: 'A2' },
  { english: 'to save money', german: 'Geld sparen', level: 'A2' },
  { english: 'mobile phone', german: 'Handy', alternatives_en: ['smartphone', 'cell phone', 'phone'], type: 'word', level: 'A2' },
  { english: 'to download an app', german: 'eine App herunterladen', level: 'A2' },
  { english: 'screen time', german: 'Bildschirmzeit', type: 'word', level: 'B1' },
  { english: 'to go on holiday', german: 'in den Urlaub fahren', alternatives_en: ['to go on vacation'], level: 'A2' },
  { english: 'Last summer we went to the seaside.', german: 'Letzten Sommer sind wir ans Meer gefahren.', type: 'sentence', level: 'A2' },
  { english: "I'm going to visit my grandparents.", german: 'Ich werde meine Großeltern besuchen.', explanation: "'going to' für Pläne, die schon feststehen.", type: 'sentence', level: 'A2' },
  { english: 'environment', german: 'Umwelt', type: 'word', level: 'B1' },
  { english: 'to recycle', german: 'recyceln, wiederverwerten', type: 'word', level: 'A2' },
  { english: 'to be bored', german: 'sich langweilen', common_mistake: "I'm boring.", explanation: "'I'm bored' = mir ist langweilig. 'I'm boring' = ich bin langweilig!", type: 'correction', level: 'A2' },
  { english: 'to hang out with friends', german: 'mit Freunden abhängen', level: 'A2' },
  { english: 'healthy food', german: 'gesundes Essen', level: 'A2' },
  { english: 'public transport', german: 'öffentliche Verkehrsmittel', level: 'B1' },
];

const school910: Raw[] = [
  { english: 'work experience', german: 'Betriebspraktikum', alternatives_en: ['internship', 'work placement'], type: 'word', level: 'B1' },
  { english: 'to apply for a job', german: 'sich um eine Stelle bewerben', level: 'B1' },
  { english: 'application', german: 'Bewerbung', type: 'word', level: 'B1' },
  { english: 'CV', german: 'Lebenslauf', alternatives_en: ['résumé', 'curriculum vitae'], type: 'word', level: 'B1' },
  { english: 'to graduate', german: 'den Abschluss machen', type: 'word', level: 'B1' },
  { english: 'to take an exam', german: 'eine Prüfung ablegen', common_mistake: 'to write an exam', explanation: "Im Englischen 'take an exam' (bestehen: 'pass', durchfallen: 'fail').", type: 'correction', level: 'B1' },
  { english: 'to pass an exam', german: 'eine Prüfung bestehen', level: 'B1' },
  { english: 'to fail an exam', german: 'durch eine Prüfung fallen', level: 'B1' },
  { english: 'If I study hard, I will pass the exam.', german: 'Wenn ich viel lerne, bestehe ich die Prüfung.', explanation: 'If-Satz Typ 1: if + present, will + Infinitiv.', type: 'sentence', level: 'B1' },
  { english: 'If I had more time, I would learn Spanish.', german: 'Wenn ich mehr Zeit hätte, würde ich Spanisch lernen.', explanation: 'If-Satz Typ 2: if + past, would + Infinitiv.', type: 'sentence', level: 'B1' },
  { english: 'to summarise a text', german: 'einen Text zusammenfassen', alternatives_en: ['to summarize a text'], level: 'B1' },
  { english: 'On the one hand … on the other hand …', german: 'Einerseits … andererseits …', type: 'phrase', level: 'B1' },
  { english: 'The essay was written by a student.', german: 'Der Aufsatz wurde von einem Schüler geschrieben.', explanation: 'Passiv: be + past participle.', type: 'sentence', level: 'B1' },
  { english: 'career', german: 'Laufbahn, Karriere', type: 'word', level: 'B1' },
  { english: 'to be interested in something', german: 'sich für etwas interessieren', common_mistake: 'I am interested for …', type: 'correction', level: 'B1' },
];

const family910: Raw[] = [
  { english: 'peer pressure', german: 'Gruppenzwang', type: 'word', level: 'B2' },
  { english: 'to make friends', german: 'Freunde finden', common_mistake: 'to find friends', level: 'B1' },
  { english: 'to rely on someone', german: 'sich auf jemanden verlassen', level: 'B1' },
  { english: 'independent', german: 'selbstständig, unabhängig', type: 'word', level: 'B1' },
  { english: 'responsibility', german: 'Verantwortung', type: 'word', level: 'B1' },
  { english: 'to stand up for someone', german: 'sich für jemanden einsetzen', level: 'B1' },
  { english: 'He said that he was tired.', german: 'Er sagte, dass er müde sei.', explanation: 'Indirekte Rede: Zeit wird eine Stufe zurückversetzt (am → was).', type: 'sentence', level: 'B1' },
  { english: 'to have a lot in common', german: 'viel gemeinsam haben', level: 'B1' },
  { english: 'self-confident', german: 'selbstbewusst', alternatives_en: ['confident'], type: 'word', level: 'B1' },
  { english: 'to cope with stress', german: 'mit Stress umgehen', level: 'B2' },
  { english: 'animal welfare', german: 'Tierschutz', type: 'word', level: 'B2' },
  { english: 'to volunteer', german: 'sich ehrenamtlich engagieren', type: 'word', level: 'B1' },
  { english: 'generation gap', german: 'Generationenkonflikt', type: 'word', level: 'B2' },
  { english: 'I am looking forward to meeting you.', german: 'Ich freue mich darauf, dich kennenzulernen.', explanation: "Nach 'look forward to' folgt die -ing-Form.", type: 'sentence', level: 'B1' },
  { english: 'The friend who helped me is called Tom.', german: 'Der Freund, der mir geholfen hat, heißt Tom.', explanation: "Relativsatz mit 'who' für Personen.", type: 'sentence', level: 'B1' },
];

const daily910: Raw[] = [
  { english: 'social media', german: 'soziale Medien', level: 'B1' },
  { english: 'to post something online', german: 'etwas online posten', level: 'B1' },
  { english: 'fake news', german: 'Falschmeldungen', level: 'B1' },
  { english: 'privacy', german: 'Privatsphäre, Datenschutz', type: 'word', level: 'B1' },
  { english: 'climate change', german: 'Klimawandel', level: 'B1' },
  { english: 'to reduce waste', german: 'Müll vermeiden / reduzieren', level: 'B1' },
  { english: 'sustainable', german: 'nachhaltig', type: 'word', level: 'B2' },
  { english: 'renewable energy', german: 'erneuerbare Energie', level: 'B2' },
  { english: 'to take part in something', german: 'an etwas teilnehmen', level: 'B1' },
  { english: 'part-time job', german: 'Nebenjob', type: 'word', level: 'B1' },
  { english: 'to earn money', german: 'Geld verdienen', level: 'B1' },
  { english: 'to travel abroad', german: 'ins Ausland reisen', level: 'B1' },
  { english: 'exchange student', german: 'Austauschschüler(in)', type: 'word', level: 'B1' },
  { english: 'I would rather stay at home.', german: 'Ich würde lieber zu Hause bleiben.', type: 'sentence', level: 'B1' },
  { english: 'It depends on the situation.', german: 'Das kommt auf die Situation an.', type: 'sentence', level: 'B1' },
];

const withCat = (rows: Raw[], category: string, source: string) => rows.map((r) => ({ ...r, category, source }));

export const STARTER_KIDS_7_8: Raw[] = [
  ...withCat(school78, 'School & Classroom', 'starter-kids-7-8'),
  ...withCat(family78, 'Family & Animals', 'starter-kids-7-8'),
  ...withCat(daily78, 'Daily Life', 'starter-kids-7-8'),
];

export const STARTER_KIDS_9_10: Raw[] = [
  ...withCat(school910, 'School & Classroom', 'starter-kids-9-10'),
  ...withCat(family910, 'Family & Animals', 'starter-kids-9-10'),
  ...withCat(daily910, 'Daily Life', 'starter-kids-9-10'),
];
