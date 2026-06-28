export function formatTime(ms: number): string {
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const centSeconds = Math.floor((ms % 1000) / 10);

	return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(centSeconds).padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
	return date.toLocaleDateString('en-US', {
		month: 'short',
		day: 'numeric'
	});
}

export function getRankEmoji(rank: number): string {
	if (rank === 1) return '👑';
	if (rank === 2) return '🥈';
	if (rank === 3) return '🥉';
	return '';
}
