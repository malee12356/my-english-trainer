import { useApp } from '../state';
import { NavBar } from '../ui/components';

export function InfoScreen() {
  const { L } = useApp();
  return (
    <main className="page">
      <NavBar title={L('Info', 'About')} back="/settings" />
      <div className="stack small">
        <div className="card">
          <h3>{L('Auf dem iPhone installieren', 'Install on iPhone')}</h3>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            <li>{L('Diese Seite in Safari öffnen.', 'Open this page in Safari.')}</li>
            <li>{L('Teilen-Symbol (Quadrat mit Pfeil) antippen.', 'Tap the Share icon.')}</li>
            <li>{L('„Zum Home-Bildschirm“ wählen → „Hinzufügen“.', 'Choose "Add to Home Screen" → "Add".')}</li>
            <li>{L('App über das neue Symbol starten (Vollbild, offline nutzbar).', 'Start the app from the new icon (full screen, works offline).')}</li>
          </ol>
        </div>
        <div className="card">
          <h3>{L('Updates', 'Updates')}</h3>
          <p className="muted" style={{ margin: 0 }}>{L('Neue Versionen werden beim Öffnen im Hintergrund geladen. Dann erscheint „Neue Version verfügbar“ → „Aktualisieren“. Deine Lerndaten bleiben dabei erhalten (sie liegen getrennt vom App-Code in IndexedDB).', 'New versions are fetched in the background when you open the app. Then "New version available" → "Update" appears. Your data is kept (stored separately from the app code in IndexedDB).')}</p>
        </div>
        <div className="card">
          <h3>{L('Grenzen unter iOS', 'iOS limits')}</h3>
          <ul style={{ paddingLeft: 20, margin: 0 }} className="muted">
            <li>{L('Sprachausgabe stoppt bei gesperrtem Bildschirm oder wenn die App in den Hintergrund geht.', 'Speech output stops when the screen locks or the app goes to the background.')}</li>
            <li>{L('Ein Ton muss durch einen Tipp gestartet werden (keine Autoplay-Garantie).', 'Audio must be started by a tap (no autoplay guarantee).')}</li>
            <li>{L('Speaking Mode: Die Spracherkennung benötigt Internet und kann in der installierten Web-App unzuverlässig sein. Dann hilft „Stattdessen schreiben“ oder die Nutzung in Safari.', 'Speaking Mode: speech recognition needs internet and may be unreliable in the installed web app. Use "Type instead" or Safari then.')}</li>
            <li>{L('Driving Mode: Ein bildschirmfreier Betrieb mit gesperrtem Display ist als Web-App nicht zuverlässig möglich. Wird in Phase 3 geprüft (ggf. native Erweiterung).', 'Driving Mode: screen-free use with a locked display is not reliably possible as a web app. Evaluated in phase 3 (possibly a native extension).')}</li>
            <li>{L('Daten können von iOS bei Speichermangel gelöscht werden → regelmäßig Backups.', 'iOS may delete data when storage is low → back up regularly.')}</li>
          </ul>
        </div>
        <div className="card">
          <h3>{L('Datenschutz', 'Privacy')}</h3>
          <p className="muted" style={{ margin: 0 }}>{L('Keine Registrierung, kein Tracking, keine Analytics, keine Cloud. Alle Inhalte und Lerndaten bleiben auf diesem Gerät. Importierte Inhalte werden nur als Text angezeigt (kein HTML/Skript). Das Mikrofon wird nur im Speaking Mode und nur während des Sprechens genutzt. Die Spracherkennung des Geräts kann die Aufnahme beim Anbieter (Apple/Google) verarbeiten – deshalb wird vorher um Zustimmung gebeten. Die App speichert keine Aufnahmen.', 'No sign-up, no tracking, no analytics, no cloud. All content and learning data stay on this device. Imported content is shown as text only (no HTML/script). The microphone is only used in Speaking Mode while you speak. The device speech recognition may process audio at the provider (Apple/Google) – consent is asked first. The app stores no recordings.')}</p>
        </div>
        <p className="tiny muted center">Personal English Trainer · Version {__APP_VERSION__} · Build {__BUILD_TIME__.slice(0, 16).replace('T', ' ')}</p>
      </div>
    </main>
  );
}
