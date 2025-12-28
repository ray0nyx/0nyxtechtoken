import React, { useEffect, useState } from 'react';

interface Circle {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  startDelay: number;
}

const WagyuLoader = () => {
  const [circles, setCircles] = useState<Circle[]>([]);
  const [isAnimating, setIsAnimating] = useState(true);
  const ANIMATION_DURATION = 5000; // 5 seconds in milliseconds

  useEffect(() => {
    // Create initial circles with staggered start delays
    const initialCircles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: 20 + Math.random() * 30,
      speed: 0.3 + Math.random() * 0.5, // Slower speed for longer animation
      opacity: 0.3 + Math.random() * 0.4,
      startDelay: i * 500, // Stagger the start of each circle by 500ms
    }));
    setCircles(initialCircles);

    // Animation loop
    let animationFrameId: number;
    let startTime = Date.now();

    const animate = () => {
      if (!isAnimating) return;

      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      // Stop animation after ANIMATION_DURATION
      if (elapsed >= ANIMATION_DURATION) {
        setIsAnimating(false);
        return;
      }

      setCircles(prevCircles => prevCircles.map(circle => {
        // Don't start animating until after the circle's start delay
        if (elapsed < circle.startDelay) {
          return circle;
        }

        const circleElapsed = (elapsed - circle.startDelay) / 1000;
        const progress = Math.min(circleElapsed / (ANIMATION_DURATION / 1000), 1);

        // Calculate center point (where the 0nyx text is)
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;

        // Calculate angle based on time and speed
        const angle = circleElapsed * circle.speed * Math.PI * 2;
        
        // Calculate new position with spiral motion towards center
        // Start with larger radius and gradually decrease it
        const startRadius = 400;
        const endRadius = 100;
        const radius = startRadius - (startRadius - endRadius) * progress;
        
        const x = centerX + Math.cos(angle) * radius;
        const y = centerY + Math.sin(angle) * radius;

        // Fade out the opacity as the circle gets closer to the center
        const newOpacity = circle.opacity * (1 - progress * 0.5);

        return {
          ...circle,
          x,
          y,
          opacity: newOpacity,
        };
      }));

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      cancelAnimationFrame(animationFrameId);
      setIsAnimating(false);
    };
  }, [isAnimating]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black overflow-hidden">
      {/* Enhanced background effect with slower pulse */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-purple-500/10 animate-[pulse_5s_ease-in-out_infinite]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-500/20 via-transparent to-transparent"></div>
      </div>

      {/* Animated circles */}
      {circles.map(circle => (
        <div
          key={circle.id}
          className="absolute rounded-full border-4 border-purple-500/30"
          style={{
            left: circle.x,
            top: circle.y,
            width: circle.size,
            height: circle.size,
            opacity: circle.opacity,
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.8s ease-out',
          }}
        />
      ))}

      {/* Main content container */}
      <div className="relative">
        {/* Glowing effect behind the text */}
        <div className="absolute inset-0 blur-2xl">
          <div className="w-full h-full bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-purple-500/30"></div>
        </div>

        {/* Main content */}
        <div className="relative flex flex-col items-center">
          {/* Enhanced Wagyu text with multiple layers for depth */}
          <div className="relative">
            <h1 className="text-7xl font-bold animate-[pulse_5s_ease-in-out_infinite]">
              <span className="text-purple-500">0nyx</span><span className="text-gray-500">Tech</span>
            </h1>
            {/* Text shadow effect */}
            <div className="absolute inset-0 blur-md">
              <h1 className="text-7xl font-bold">
                <span className="text-purple-500/30">0nyx</span><span className="text-gray-500/30">Tech</span>
              </h1>
            </div>
          </div>

          {/* Loading text with enhanced animation */}
          <div className="mt-8 relative">
            <p className="text-zinc-400 text-lg">
              Loading your experience
              <span className="inline-block animate-[bounce_2s_ease-in-out_infinite]">.</span>
              <span className="inline-block animate-[bounce_2s_ease-in-out_infinite]" style={{ animationDelay: '0.4s' }}>.</span>
              <span className="inline-block animate-[bounce_2s_ease-in-out_infinite]" style={{ animationDelay: '0.8s' }}>.</span>
            </p>
          </div>
        </div>
      </div>

      {/* Add keyframe animations */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};

export default WagyuLoader; 