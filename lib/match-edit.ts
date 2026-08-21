import type { CreateMatchPayload, Match } from './types';

type EditableMatchField = 'matchDate' | 'opponentName' | 'myScore' | 'opponentScore' | 'note' | 'season' | 'competition' | 'matchType';
export type MatchPatchPayload = Partial<Pick<CreateMatchPayload, EditableMatchField>>;

const textValue = (value: FormDataEntryValue | null) => typeof value === 'string' ? value.trim() : '';
const currentText = (value: string | undefined) => value?.trim() ?? '';

/** Build a real partial PATCH so an unchanged date never triggers datetime rebuilding. */
export function buildMatchPatch(match: Match, data: FormData): MatchPatchPayload {
  const patch: MatchPatchPayload = {};
  const matchDate = textValue(data.get('matchDate'));
  const opponentName = textValue(data.get('opponentName'));
  const note = textValue(data.get('note'));
  const season = textValue(data.get('season'));
  const competition = textValue(data.get('competition'));
  const matchType = textValue(data.get('matchType'));
  const myScore = Number(data.get('myScore'));
  const opponentScore = Number(data.get('opponentScore'));

  if (matchDate !== match.matchDate) patch.matchDate = matchDate;
  if (opponentName !== currentText(match.opponentName)) patch.opponentName = opponentName;
  if (note !== currentText(match.note)) patch.note = note;
  if (season !== currentText(match.season)) patch.season = season;
  if (competition !== currentText(match.competition)) patch.competition = competition;
  if (matchType !== currentText(match.matchType)) patch.matchType = matchType;
  if (myScore !== match.myScore) patch.myScore = myScore;
  if (opponentScore !== match.opponentScore) patch.opponentScore = opponentScore;
  return patch;
}
