'use client';

import { Children, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSettledReducedMotion } from '@/components/motion/Reveal';

/**
 * Stepper, adapted from React Bits (JS + CSS variant).
 *
 * Two deliberate departures from the upstream source:
 *  - its stylesheet is dropped. Those class names are global and its palette is
 *    the React Bits purple; this site's colours live in Tailwind tokens, so the
 *    styling is expressed there and nothing new lands in the global namespace.
 *  - every animation collapses to zero duration under `prefers-reduced-motion`,
 *    the way the rest of the landing page's motion already behaves.
 */

interface StepperProps {
  children: ReactNode;
  initialStep?: number;
  onStepChange?: (step: number) => void;
  onFinalStepCompleted?: () => void;
  stepCircleContainerClassName?: string;
  stepContainerClassName?: string;
  contentClassName?: string;
  footerClassName?: string;
  backButtonText?: string;
  nextButtonText?: string;
  completeButtonText?: string;
  /**
   * Drops the primary button on the last step, for steppers that explain
   * rather than collect — there is nothing to complete. The footer itself
   * stays: it still carries Back, and the padding that keeps the last step's
   * text off the bottom edge of the card.
   */
  hideCompleteButton?: boolean;
  disableStepIndicators?: boolean;
  renderStepIndicator?: (props: {
    step: number;
    currentStep: number;
    onStepClick: (clicked: number) => void;
  }) => ReactNode;
  className?: string;
}

export default function Stepper({
  children,
  initialStep = 1,
  onStepChange = () => {},
  onFinalStepCompleted = () => {},
  stepCircleContainerClassName = '',
  stepContainerClassName = '',
  contentClassName = '',
  footerClassName = '',
  backButtonText = 'Kembali',
  nextButtonText = 'Lanjut',
  completeButtonText = 'Selesai',
  hideCompleteButton = false,
  disableStepIndicators = false,
  renderStepIndicator,
  className,
}: StepperProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState(0);
  const reduce = useSettledReducedMotion();
  const stepsArray = Children.toArray(children);
  const totalSteps = stepsArray.length;
  const isCompleted = currentStep > totalSteps;
  const isLastStep = currentStep === totalSteps;

  const updateStep = (newStep: number) => {
    setCurrentStep(newStep);
    if (newStep > totalSteps) onFinalStepCompleted();
    else onStepChange(newStep);
  };

  const goTo = (step: number) => {
    setDirection(step > currentStep ? 1 : -1);
    updateStep(step);
  };

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'mx-auto w-full rounded-[var(--radius-sk-3xl)] border border-sk-border bg-white shadow-sk-md',
          stepCircleContainerClassName,
        )}
      >
        <div className={cn('flex w-full items-center px-7 pt-7 md:px-9 md:pt-8', stepContainerClassName)}>
          {stepsArray.map((_, index) => {
            const stepNumber = index + 1;
            const isNotLastStep = index < totalSteps - 1;
            return (
              <div key={stepNumber} className="flex items-center last:flex-none [&:not(:last-child)]:flex-1">
                {renderStepIndicator ? (
                  renderStepIndicator({ step: stepNumber, currentStep, onStepClick: goTo })
                ) : (
                  <StepIndicator
                    step={stepNumber}
                    currentStep={currentStep}
                    onClickStep={goTo}
                    disableStepIndicators={disableStepIndicators}
                    reduce={reduce}
                  />
                )}
                {isNotLastStep && <StepConnector isComplete={currentStep > stepNumber} reduce={reduce} />}
              </div>
            );
          })}
        </div>

        <StepContentWrapper
          isCompleted={isCompleted}
          currentStep={currentStep}
          direction={direction}
          reduce={reduce}
          className={cn('relative overflow-hidden', contentClassName)}
        >
          {stepsArray[currentStep - 1]}
        </StepContentWrapper>

        {!isCompleted && (
          <div className={cn('px-7 pb-7 md:px-9 md:pb-8', footerClassName)}>
            <div
              className={cn(
                'mt-8 flex items-center',
                currentStep === 1 ? 'justify-end' : 'justify-between',
                isLastStep && hideCompleteButton && 'justify-start',
              )}
            >
              {currentStep !== 1 && (
                <button
                  type="button"
                  onClick={() => goTo(currentStep - 1)}
                  className="rounded-[var(--radius-sk)] px-2 py-1 text-[14px] font-semibold text-sk-muted transition-colors duration-300 hover:text-sk-navy"
                >
                  {backButtonText}
                </button>
              )}
              {!(isLastStep && hideCompleteButton) && (
                <button
                  type="button"
                  onClick={() => goTo(isLastStep ? totalSteps + 1 : currentStep + 1)}
                  className="inline-flex items-center justify-center rounded-full bg-sk-blue px-4 py-2 text-[14px] font-semibold tracking-[-0.01em] text-white shadow-sk-btn transition-colors duration-300 hover:bg-sk-blue-700"
                >
                  {isLastStep ? completeButtonText : nextButtonText}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StepContentWrapper({
  isCompleted,
  currentStep,
  direction,
  children,
  className,
  reduce,
}: {
  isCompleted: boolean;
  currentStep: number;
  direction: number;
  children: ReactNode;
  className?: string;
  reduce: boolean;
}) {
  const [parentHeight, setParentHeight] = useState(0);

  return (
    <motion.div
      className={className}
      animate={{ height: isCompleted ? 0 : parentHeight }}
      transition={reduce ? { duration: 0 } : { type: 'spring', duration: 0.4, bounce: 0 }}
    >
      <AnimatePresence initial={false} mode="sync" custom={direction}>
        {!isCompleted && (
          <SlideTransition
            key={currentStep}
            direction={direction}
            reduce={reduce}
            onHeightReady={(h) => setParentHeight(h)}
          >
            {children}
          </SlideTransition>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SlideTransition({
  children,
  direction,
  onHeightReady,
  reduce,
}: {
  children: ReactNode;
  direction: number;
  onHeightReady: (height: number) => void;
  reduce: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (containerRef.current) onHeightReady(containerRef.current.offsetHeight);
  }, [children, onHeightReady]);

  return (
    <motion.div
      ref={containerRef}
      custom={direction}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
      className="absolute left-0 right-0 top-0"
    >
      {children}
    </motion.div>
  );
}

const stepVariants = {
  enter: (dir: number) => ({ x: dir >= 0 ? '-100%' : '100%', opacity: 0 }),
  center: { x: '0%', opacity: 1 },
  exit: (dir: number) => ({ x: dir >= 0 ? '50%' : '-50%', opacity: 0 }),
};

export function Step({ children }: { children: ReactNode }) {
  return <div className="px-7 md:px-9">{children}</div>;
}

function StepIndicator({
  step,
  currentStep,
  onClickStep,
  disableStepIndicators,
  reduce,
}: {
  step: number;
  currentStep: number;
  onClickStep: (step: number) => void;
  disableStepIndicators?: boolean;
  reduce: boolean;
}) {
  const status = currentStep === step ? 'active' : currentStep < step ? 'inactive' : 'complete';

  return (
    <button
      type="button"
      onClick={() => step !== currentStep && !disableStepIndicators && onClickStep(step)}
      disabled={disableStepIndicators}
      aria-current={status === 'active' ? 'step' : undefined}
      aria-label={`Langkah ${step}`}
      className={cn('relative flex-none outline-none', disableStepIndicators ? 'cursor-default' : 'cursor-pointer')}
    >
      <motion.span
        variants={{
          inactive: { backgroundColor: '#ebf1ff', color: '#5a6a85', borderColor: '#cddcff' },
          active: { backgroundColor: '#246bfd', color: '#ffffff', borderColor: '#246bfd' },
          complete: { backgroundColor: '#246bfd', color: '#ffffff', borderColor: '#246bfd' },
        }}
        animate={status}
        initial={false}
        transition={reduce ? { duration: 0 } : { duration: 0.3 }}
        className="flex h-9 w-9 items-center justify-center rounded-full border text-[13px] font-bold"
      >
        {status === 'complete' ? <Check size={15} strokeWidth={3} aria-hidden /> : step}
      </motion.span>
    </button>
  );
}

function StepConnector({ isComplete, reduce }: { isComplete: boolean; reduce: boolean }) {
  return (
    <div className="relative mx-3 h-0.5 flex-1 overflow-hidden rounded-full bg-sk-blue-tint-border">
      <motion.div
        className="absolute left-0 top-0 h-full bg-sk-blue"
        initial={false}
        animate={{ width: isComplete ? '100%' : 0 }}
        transition={reduce ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}
