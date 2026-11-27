import { navigate } from '../../state';
import { SetupCodeSheet } from './ParentUI';

/** #/setup?c=PET1-… opened in an app that already has data. */
export function SetupLinkScreen() {
  return (
    <main className="page">
      <SetupCodeSheet open onClose={() => navigate('/settings', true)} onApplied={() => navigate('/home', true)} initialText={location.href} />
    </main>
  );
}
