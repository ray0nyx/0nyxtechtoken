import React, { useEffect, useRef } from 'react';

interface Node {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
}

interface Web3BackgroundProps {
    className?: string;
    logoOpacity?: number;
}

export const Web3Background: React.FC<Web3BackgroundProps> = ({ className, logoOpacity = 0.05 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    const nodesRef = useRef<Node[]>([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;

            // Re-initialize nodes on resize to fill screen
            const nodeCount = Math.floor((canvas.width * canvas.height) / 25000);
            nodesRef.current = Array.from({ length: Math.min(nodeCount, 60) }, () => ({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 1.5 + 0.5,
            }));
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const animate = () => {
            if (!ctx || !canvas) return;

            // Clear background
            ctx.fillStyle = '#06060c';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const nodes = nodesRef.current;
            const connectionDistance = 180;

            // Update and draw nodes
            nodes.forEach((node, i) => {
                node.x += node.vx;
                node.y += node.vy;

                if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
                if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

                // Draw connections
                for (let j = i + 1; j < nodes.length; j++) {
                    const other = nodes[j];
                    const dx = other.x - node.x;
                    const dy = other.y - node.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < connectionDistance) {
                        const opacity = (1 - distance / connectionDistance) * 0.15;
                        ctx.beginPath();
                        ctx.moveTo(node.x, node.y);
                        ctx.lineTo(other.x, other.y);
                        ctx.strokeStyle = `rgba(148, 163, 184, ${opacity})`;
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }

                // Draw node
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(148, 163, 184, 0.4)';
                ctx.fill();
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, []);

    return (
        <div className={className || "fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#06060c]"}>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
            />

            <div className="absolute inset-0 flex items-center justify-center" style={{ opacity: logoOpacity }}>
                <img
                    src="/images/0nyxtech Logo.svg"
                    alt="Background Logo"
                    className="w-[110%] h-[110%] object-contain select-none pointer-events-none animate-slow-spin"
                />
            </div>

            {/* Gradients for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(6,6,12,0.6)_100%)]" />

            <style>{`
                @keyframes slow-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .animate-slow-spin {
                    animation: slow-spin 180s linear infinite;
                }
            `}</style>
        </div>
    );
};

export default Web3Background;
