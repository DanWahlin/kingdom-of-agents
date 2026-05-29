import { test, expect } from '@playwright/test';
import { GAME_URL, waitForGame } from './helpers';

test.describe('Copilot Mission Control app shell', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForGame(page);
  });

  test('top bar shows brand and theme toggle', async ({ page }) => {
    await expect(page.locator('#topbar .brand')).toContainText('Copilot Mission Control');
    await expect(page.locator('#reset-btn')).toBeVisible();
    await expect(page.locator('#settings-btn')).toBeVisible();
    await expect(page.locator('#theme-btn')).toBeVisible();
    await expect(page.locator('#mission-route-btn')).toHaveAttribute('aria-label', 'Show Home');
    await expect(page.locator('#history-route-btn')).toHaveAttribute('aria-label', 'Show global History analytics');
    await expect(page.locator('#reset-btn')).toHaveAttribute('aria-label', 'Reset visible activity counters');
    await expect(page.locator('#mission-route-btn svg')).toBeVisible();
    await expect(page.locator('#history-route-btn svg')).toBeVisible();
    await expect(page.locator('#reset-btn svg')).toBeVisible();
    await expect(page.locator('#topbar-controls')).not.toContainText(/Home|History|Reset/);
    const topbarIconStyles = await page.evaluate(() => {
      const routeGroup = document.querySelector('.topbar-route-group') as HTMLElement;
      const missionRoute = document.querySelector('#mission-route-btn') as HTMLElement;
      const resetSvg = document.querySelector('#reset-btn svg') as SVGElement;
      const resetPaths = Array.from(document.querySelectorAll('#reset-btn svg path')).map((path) => path.getAttribute('d'));
      const routeGroupStyle = getComputedStyle(routeGroup);
      const missionRouteStyle = getComputedStyle(missionRoute);
      return {
        routeGroupBorderWidth: routeGroupStyle.borderTopWidth,
        routeBorderColor: missionRouteStyle.borderTopColor,
        routeBackgroundImage: missionRouteStyle.backgroundImage,
        routeBoxShadow: missionRouteStyle.boxShadow,
        resetIconWidth: getComputedStyle(resetSvg).width,
        resetPaths,
      };
    });
    expect(topbarIconStyles.routeGroupBorderWidth).toBe('0px');
    expect(topbarIconStyles.routeBorderColor).toBe('rgba(0, 0, 0, 0)');
    expect(topbarIconStyles.routeBackgroundImage).not.toBe('none');
    expect(topbarIconStyles.routeBoxShadow).not.toBe('none');
    expect(topbarIconStyles.resetIconWidth).toBe('18px');
    expect(topbarIconStyles.resetPaths).toEqual(['M5 12a7 7 0 1 0 2.1-5', 'M5 4v4.7h4.7']);
  });

  test('top bar route buttons visually mark the active route in both themes', async ({ page }) => {
    const darkActiveColor = 'rgb(184, 255, 207)';
    const lightActiveColor = 'rgb(22, 101, 52)';
    const routeStyles = async () => page.evaluate(() => {
      const mission = document.querySelector('#mission-route-btn') as HTMLElement;
      const history = document.querySelector('#history-route-btn') as HTMLElement;
      const missionStyle = getComputedStyle(mission);
      const historyStyle = getComputedStyle(history);
      return {
        missionCurrent: mission.getAttribute('aria-current'),
        historyCurrent: history.getAttribute('aria-current'),
        missionBackgroundImage: missionStyle.backgroundImage,
        historyBackgroundImage: historyStyle.backgroundImage,
        missionColor: missionStyle.color,
        historyColor: historyStyle.color,
      };
    });

    const initial = await routeStyles();
    expect(initial.missionCurrent).toBe('page');
    expect(initial.historyCurrent).toBeNull();
    expect(initial.missionBackgroundImage).not.toBe('none');
    expect(initial.historyBackgroundImage).toBe('none');
    expect(initial.missionColor).toBe(darkActiveColor);

    await page.locator('#history-route-btn').click();
    await expect.poll(async () => (await routeStyles()).historyColor).toBe(darkActiveColor);
    const darkHistory = await routeStyles();
    expect(darkHistory.missionCurrent).toBeNull();
    expect(darkHistory.historyCurrent).toBe('page');
    expect(darkHistory.missionBackgroundImage).toBe('none');
    expect(darkHistory.historyBackgroundImage).not.toBe('none');
    expect(darkHistory.historyBackgroundImage).toBe(initial.missionBackgroundImage);
    expect(darkHistory.historyColor).toBe(initial.missionColor);

    await page.locator('#theme-btn').click();
    await expect.poll(async () => (await routeStyles()).historyColor).toBe(lightActiveColor);
    const lightHistory = await routeStyles();
    expect(lightHistory.historyCurrent).toBe('page');
    expect(lightHistory.historyBackgroundImage).not.toBe('none');
    expect(lightHistory.historyColor).toBe(lightActiveColor);

    await page.locator('#mission-route-btn').click();
    await expect.poll(async () => (await routeStyles()).missionColor).toBe(lightActiveColor);
    const lightMission = await routeStyles();
    expect(lightMission.missionCurrent).toBe('page');
    expect(lightMission.historyCurrent).toBeNull();
    expect(lightMission.missionBackgroundImage).not.toBe('none');
    expect(lightMission.historyBackgroundImage).toBe('none');
    expect(lightMission.missionBackgroundImage).toBe(lightHistory.historyBackgroundImage);
    expect(lightMission.missionColor).toBe(lightHistory.historyColor);
  });

  test('history dashboard unloads when returning to home', async ({ page }) => {
    await page.locator('#history-route-btn').click();
    await expect.poll(() => page.locator('#history-content').evaluate((el) => el.innerHTML.length)).toBeGreaterThan(0);
    await expect(page.locator('body')).toHaveClass(/history-route/);

    await page.locator('#mission-route-btn').click();
    await expect(page.locator('body')).not.toHaveClass(/history-route/);
    await expect.poll(() => page.locator('#history-content').evaluate((el) => el.innerHTML)).toBe('');
    await expect.poll(() => page.locator('#history-kpi-summary').evaluate((el) => el.innerHTML)).toBe('');
    await expect(page.locator('#history-session-filter')).toBeDisabled();
  });

  test('theme toggle persists to localStorage and flips body class', async ({ page }) => {
    const before = await page.evaluate(() => localStorage.getItem('cmc_theme'));
    expect(before).not.toBe('light');
    await expect(page.locator('body')).not.toHaveClass(/theme-light/);
    await page.locator('#theme-btn').click();
    const after = await page.evaluate(() => localStorage.getItem('cmc_theme'));
    expect(after).toBe('light');
    await expect(page.locator('body')).toHaveClass(/theme-light/);
    await page.locator('#theme-btn').click();
    const restored = await page.evaluate(() => localStorage.getItem('cmc_theme'));
    expect(restored).toBe('dark');
    await expect(page.locator('body')).not.toHaveClass(/theme-light/);
  });

  test('update banner can be shown and dismissed', async ({ page }) => {
    await expect(page.locator('#update-banner')).not.toBeVisible();
    await page.evaluate(() => (window as any).__cmcUpdateAvailable('99.0.0'));
    await expect(page.locator('#update-banner')).toBeVisible();
    await expect(page.locator('#update-version')).toHaveText('v99.0.0');
    await page.locator('#update-dismiss').click();
    await expect(page.locator('#update-banner')).not.toBeVisible();
  });

  test('settings dialog shows app theme selection', async ({ page }) => {
    await expect(page.locator('#settings-overlay')).not.toBeVisible();
    await page.locator('#settings-btn').click();
    await expect(page.locator('#settings-overlay')).toBeVisible();
    await expect(page.locator('#settings-title')).toHaveText('Settings');
    await expect(page.locator('#app-theme-select option')).toHaveText(['Space', 'Medieval Kingdom']);
    await expect(page.locator('#app-theme-select')).toHaveValue('space');
    await expect(page.locator('#app-theme-select option:checked')).toHaveText('Space');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cmc_app_theme'))).toBe('space');
    await page.locator('#app-theme-select').selectOption('medieval');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('cmc_app_theme'))).toBe('medieval');
    await expect.poll(() => page.evaluate(() => {
      const scene = (window as any).__phaserGame?.scene?.getScene?.('mission-control') as any;
      const frames = (scene?.textObjects ?? [])
        .filter((obj: any) => obj?.texture?.key)
        .map((obj: any) => ({ texture: obj.texture.key, frame: obj.frame?.name }));
      return {
        appTheme: scene?.appTheme,
        hasMedievalCastle: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'large_castle_3'),
        hasMedievalEditsHouse: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'timber_house_large'),
        hasMedievalCommandsWizard: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'blue_mage'),
        hasMedievalHooksDagger: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'dagger_blue'),
        hasMedievalHooksCrate: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'rune_crate'),
        hasMedievalSubagentsWarrior: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'dark_knight'),
        hasMedievalDragon: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'dragon'),
        hasMedievalCatapult: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'catapult'),
        hasMedievalSword: frames.some((frame: any) => frame.texture === 'medieval' && frame.frame === 'sword_silver'),
        hasRetiredPeopleSectorArt: frames.some((frame: any) => frame.texture === 'medieval' && ['queen', 'wizard_man'].includes(frame.frame)),
      };
    })).toEqual({
      appTheme: 'medieval',
      hasMedievalCastle: true,
      hasMedievalEditsHouse: true,
      hasMedievalCommandsWizard: true,
      hasMedievalHooksDagger: true,
      hasMedievalHooksCrate: false,
      hasMedievalSubagentsWarrior: true,
      hasMedievalDragon: false,
      hasMedievalCatapult: false,
      hasMedievalSword: false,
      hasRetiredPeopleSectorArt: false,
    });
    await page.locator('#app-theme-select').selectOption('space');
    await expect.poll(() => page.evaluate(() => {
      const scene = (window as any).__phaserGame?.scene?.getScene?.('mission-control') as any;
      const frames = (scene?.textObjects ?? [])
        .filter((obj: any) => obj?.texture?.key)
        .map((obj: any) => ({ texture: obj.texture.key, frame: obj.frame?.name }));
      return {
        appTheme: scene?.appTheme,
        hasSpaceOutpost: frames.some((frame: any) => frame.texture === 'mc' && frame.frame === 'outpost_domed_island'),
      };
    })).toEqual({ appTheme: 'space', hasSpaceOutpost: true });
    await page.locator('#settings-done').click();
    await expect(page.locator('#settings-overlay')).not.toBeVisible();
  });

  test('canvas mounts at full window size', async ({ page }) => {
    const dims = await page.evaluate(() => {
      const game = (window as any).__phaserGame;
      return { w: game?.config?.width ?? 0, h: game?.config?.height ?? 0 };
    });
    expect(dims.w).toBeGreaterThan(800);
    expect(dims.h).toBeGreaterThan(500);
  });
});

test.describe('Copilot Mission Control loading splash', () => {
  test('keeps the splash visible after the dashboard is ready', async ({ page }) => {
    await page.addInitScript(() => { (window as any).__cmcSplashMinMs = 60_000; });
    await page.goto(GAME_URL);
    await waitForGame(page);

    await expect(page.locator('body')).toHaveClass(/dashboard-ready/);
    await expect(page.locator('body')).not.toHaveClass(/dashboard-splash-hidden/);
    await expect(page.locator('#dashboard-loading')).toBeVisible();
  });
});
