import { beforeEach, describe, expect, it } from 'vitest';
import { TrainerDB, setDbForTests } from '../../src/db/db';
import { addItem, applySetup, ensureSetup, getSettings, loadSnapshot } from '../../src/db/repo';
import { decodeSetup, encodeSetup, hashPin, makeLock, pinWaitMs, setupMessage, verifyPin, type SetupConfig } from '../../src/domain/parental';
import { STARTER_KIDS_7_8 } from '../../src/data/starterKidsUpper';

describe('parent PIN', () => {
  it('stores only a hash, deterministic for the same PIN', async () => {
    const h = await hashPin('4711');
    expect(h).not.toContain('4711');
    expect(h).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await hashPin('4711')).toBe(h);
    expect(await hashPin('4712')).not.toBe(h);
  });
  it('verifies PINs and rejects malformed ones', async () => {
    const lock = await makeLock('123456');
    expect(await verifyPin('123456', lock)).toBe(true);
    expect(await verifyPin('123457', lock)).toBe(false);
    expect(await verifyPin('12a4', lock)).toBe(false);
    expect(await verifyPin('1234', undefined)).toBe(false);
    await expect(hashPin('12')).rejects.toThrow();
  });
  it('rate-limits after 5 wrong attempts for one minute', () => {
    expect(pinWaitMs(4, 1000, 2000)).toBe(0);
    expect(pinWaitMs(5, 1000, 2000)).toBe(59_000);
    expect(pinWaitMs(5, 1000, 70_000)).toBe(0);
  });
});

describe('setup codes', () => {
  let cfg: SetupConfig;
  beforeEach(async () => {
    cfg = { v: 1, profile: 'kid', grade: '7-8', words: 15, minutesPerWord: 2, lock: await makeLock('2468') };
  });
  it('round-trips and is found inside a whole WhatsApp message or a link', () => {
    const msg = setupMessage(cfg, 'https://example.org/app/');
    expect(msg).toContain('PET1-');
    expect(msg).not.toContain('2468');
    expect(decodeSetup(msg)).toEqual(cfg);
    expect(decodeSetup(`https://example.org/app/#/setup?c=${encodeSetup(cfg).slice(5)}`)).toEqual(cfg);
  });
  it('rejects broken or manipulated codes', () => {
    expect(decodeSetup('hello')).toBeNull();
    expect(decodeSetup('PET1-' + 'x'.repeat(40))).toBeNull();
    const bad = (patch: Record<string, unknown>) => encodeSetup({ ...cfg, ...patch } as SetupConfig);
    expect(decodeSetup(bad({ grade: '11-12' }))).toBeNull();
    expect(decodeSetup(bad({ words: 1000 }))).toBeNull();
    expect(decodeSetup(bad({ minutesPerWord: -1 }))).toBeNull();
    expect(decodeSetup(bad({ profile: 'adult' }))).toBeNull();
    expect(decodeSetup(bad({ lock: { v: 1, hash: '1234' } }))).toBeNull();
  });
});

describe('applying a setup', () => {
  let n = 0;
  beforeEach(async () => {
    setDbForTests(new TrainerDB(`setup-${++n}`));
    await ensureSetup();
  });
  it('sets profile, grade, challenge rules and lock; loads the grade pack into an empty app', async () => {
    const cfg: SetupConfig = { v: 1, profile: 'kid', grade: '7-8', words: 15, minutesPerWord: 2, lock: await makeLock('2468') };
    await applySetup(cfg);
    expect(await getSettings()).toMatchObject({ profile: 'kid', profileChosen: true, kidGrade: '7-8', challengeWords: 15, minutesPerWord: 2, parentLock: cfg.lock });
    expect((await loadSnapshot()).items).toHaveLength(STARTER_KIDS_7_8.length);
  });
  it('keeps existing content and progress', async () => {
    await addItem({ english: 'own word', german: 'eigenes Wort' });
    await applySetup({ v: 1, profile: 'kid', grade: '5-6', words: 20, minutesPerWord: 1, lock: await makeLock('1111') });
    const snap = await loadSnapshot();
    expect(snap.items.map((i) => i.english)).toEqual(['own word']);
  });
});
