import React, { useEffect, useRef } from 'react';

export const Web3GridBackground: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;
        let time = 0;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        window.addEventListener('resize', resize);
        resize();

        const draw = () => {
            time += 0.01;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Background color
            ctx.fillStyle = '#030303';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const gridSize = 40;
            const perspective = 400;

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = 1;

            // Horizontal grid lines (perspective)
            for (let i = -20; i <= 20; i++) {
                const z = (i * gridSize + (time * 50) % gridSize);
                const screenY = centerY + (perspective / z) * 100;

                if (z > 0) {
                    const opacity = Math.min(1, 100 / z);
                    ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.1})`;
                    ctx.beginPath();
                    ctx.moveTo(0, screenY);
                    ctx.lineTo(canvas.width, screenY);
                    ctx.stroke();
                }
            }

            // Vertical grid lines (perspective)
            for (let i = -15; i <= 15; i++) {
                const x = i * 150;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.beginPath();
                ctx.moveTo(centerX + x, 0);
                ctx.lineTo(centerX + x * 5, canvas.height);
                ctx.stroke();
            }

            // Floating nodes
            for (let i = 0; i < 15; i++) {
                const x = Math.sin(time + i) * centerX + centerX;
                const y = Math.cos(time * 0.5 + i) * centerY + centerY;
                const size = Math.sin(time + i) * 2 + 3;

                ctx.shadowBlur = 15;
                ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';
                ctx.fillStyle = 'rgba(226, 226, 227, 0.3)';
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

                // Subtle connection lines
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(centerX, centerY);
                ctx.stroke();
            }

            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full pointer-events-none -z-10"
            style={{ background: '#030303' }}
        />
    );
};

export default Web3GridBackground;
