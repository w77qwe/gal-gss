/* ============================================
   AUTISTIC GAMES — AUDIO PLAYER ENGINE
   ============================================ */

(function () {
    'use strict';

    // ——— Состояние плеера ———
    const state = {
        audio: new Audio(),
        currentCard: null,
        isPlaying: false,
        animFrameId: null,
    };

    // ——— Все карточки треков ———
    const trackCards = document.querySelectorAll('.track-card');

    // ==========================================
    //  УТИЛИТЫ
    // ==========================================

    /**
     * Форматирует секунды → "m:ss"
     */
    function formatTime(sec) {
        if (!sec || !isFinite(sec)) return '0:00';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Возвращает DOM-элементы внутри карточки
     */
    function getCardElements(card) {
        return {
            progressBar:  card.querySelector('.progress-bar'),
            progressFill: card.querySelector('.progress-fill'),
            timeDisplay:  card.querySelector('.track-time'),
            btnPlay:      card.querySelector('.btn-play'),
        };
    }

    // ==========================================
    //  ОБНОВЛЕНИЕ ПРОГРЕССА (requestAnimationFrame)
    // ==========================================

    function startProgressLoop() {
        cancelAnimationFrame(state.animFrameId);

        function loop() {
            if (state.currentCard && state.isPlaying) {
                const { progressFill, timeDisplay } = getCardElements(state.currentCard);
                const { currentTime, duration } = state.audio;

                if (duration && isFinite(duration)) {
                    const pct = (currentTime / duration) * 100;
                    progressFill.style.width = `${pct}%`;
                    timeDisplay.textContent = formatTime(currentTime);
                }
            }
            state.animFrameId = requestAnimationFrame(loop);
        }

        state.animFrameId = requestAnimationFrame(loop);
    }

    function stopProgressLoop() {
        cancelAnimationFrame(state.animFrameId);
        state.animFrameId = null;
    }

    // ==========================================
    //  СБРОС КАРТОЧКИ
    // ==========================================

    function resetCard(card) {
        if (!card) return;
        const { progressFill, timeDisplay } = getCardElements(card);
        card.classList.remove('playing');
        progressFill.style.width = '0%';
        timeDisplay.textContent = '0:00';
    }

    // ==========================================
    //  PLAY / PAUSE
    // ==========================================

    function playTrack(card) {
        const src = card.dataset.src;

        // Если кликнули по тому же треку — toggle pause/play
        if (state.currentCard === card) {
            if (state.isPlaying) {
                pauseTrack();
            } else {
                resumeTrack();
            }
            return;
        }

        // Если играл другой трек — сбросить его
        if (state.currentCard) {
            resetCard(state.currentCard);
        }

        // Загружаем новый трек
        state.audio.src = src;
        state.audio.load();
        state.currentCard = card;

        state.audio.play()
            .then(() => {
                state.isPlaying = true;
                card.classList.add('playing');
                startProgressLoop();
            })
            .catch((err) => {
                console.warn('Playback error:', err);
            });
    }

    function pauseTrack() {
        state.audio.pause();
        state.isPlaying = false;
        stopProgressLoop();
        if (state.currentCard) {
            state.currentCard.classList.remove('playing');
        }
    }

    function resumeTrack() {
        state.audio.play()
            .then(() => {
                state.isPlaying = true;
                if (state.currentCard) {
                    state.currentCard.classList.add('playing');
                }
                startProgressLoop();
            })
            .catch((err) => {
                console.warn('Resume error:', err);
            });
    }

    // ==========================================
    //  АВТОПЕРЕХОД К СЛЕДУЮЩЕМУ ТРЕКУ
    // ==========================================

    function playNext() {
        if (!state.currentCard) return;

        const cards = Array.from(trackCards);
        const idx = cards.indexOf(state.currentCard);
        const nextIdx = idx + 1;

        // Сбрасываем текущий
        resetCard(state.currentCard);
        stopProgressLoop();

        if (nextIdx < cards.length) {
            // Играем следующий
            state.currentCard = null;
            state.isPlaying = false;
            playTrack(cards[nextIdx]);
        } else {
            // Список закончился — полный сброс
            state.currentCard = null;
            state.isPlaying = false;
        }
    }

    // ==========================================
    //  ПЕРЕМОТКА ПО КЛИКУ НА PROGRESS BAR
    // ==========================================

    function seekTo(card, e) {
        if (state.currentCard !== card) return;

        const bar = card.querySelector('.progress-bar');
        const rect = bar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));

        if (state.audio.duration && isFinite(state.audio.duration)) {
            state.audio.currentTime = pct * state.audio.duration;
        }
    }

    // ==========================================
    //  DRAG-перемотка (зажать и тянуть)
    // ==========================================

    function initDrag(card, startEvent) {
        if (state.currentCard !== card) return;

        startEvent.preventDefault();
        const bar = card.querySelector('.progress-bar');

        function onMove(e) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const rect = bar.getBoundingClientRect();
            const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));

            if (state.audio.duration && isFinite(state.audio.duration)) {
                state.audio.currentTime = pct * state.audio.duration;
            }
        }

        function onEnd() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onEnd);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onEnd);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onEnd);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
    }

    // ==========================================
    //  ПРИВЯЗКА СОБЫТИЙ
    // ==========================================

    trackCards.forEach((card) => {
        const { btnPlay, progressBar } = getCardElements(card);

        // Кнопка Play
        btnPlay.addEventListener('click', (e) => {
            e.stopPropagation();
            playTrack(card);
        });

        // Клик по progress bar
        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            seekTo(card, e);
        });

        // Drag по progress bar
        progressBar.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            seekTo(card, e);
            initDrag(card, e);
        });

        progressBar.addEventListener('touchstart', (e) => {
            e.stopPropagation();
            const touch = e.touches[0];
            seekTo(card, touch);
            initDrag(card, e);
        }, { passive: false });
    });

    // Когда трек закончился — следующий
    state.audio.addEventListener('ended', playNext);

    // Обновляем время при загрузке метаданных
    state.audio.addEventListener('loadedmetadata', () => {
        if (state.currentCard) {
            const { timeDisplay } = getCardElements(state.currentCard);
            timeDisplay.textContent = formatTime(state.audio.duration);
        }
    });

    // ==========================================
    //  КЛАВИАТУРА: пробел = пауза/возобновление
    // ==========================================

    document.addEventListener('keydown', (e) => {
        // Не перехватываем, если фокус в input/textarea
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (!state.currentCard) return;

            if (state.isPlaying) {
                pauseTrack();
            } else {
                resumeTrack();
            }
        }

        // Стрелка вправо → следующий трек
        if (e.code === 'ArrowRight' && e.shiftKey) {
            e.preventDefault();
            playNext();
        }
    });

    // ==========================================
    //  MEDIA SESSION API (для уведомлений ОС)
    // ==========================================

    if ('mediaSession' in navigator) {
        state.audio.addEventListener('play', () => {
            if (!state.currentCard) return;
            const name = state.currentCard.querySelector('.track-name').textContent;

            navigator.mediaSession.metadata = new MediaMetadata({
                title: name,
                artist: 'Autistic Games',
                album: 'GSS Original Soundtracks',
            });
        });

        navigator.mediaSession.setActionHandler('play', resumeTrack);
        navigator.mediaSession.setActionHandler('pause', pauseTrack);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('previoustrack', () => {
            // Перемотка в начало текущего трека
            if (state.audio.currentTime > 3) {
                state.audio.currentTime = 0;
            }
        });
    }

})();