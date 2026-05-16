import React from "react";
import { cn } from "../../utils/cn";

interface FormGroupProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  wrapperClassName?: string;
}

export const FormGroup = React.forwardRef<HTMLInputElement, FormGroupProps>(
  ({ label, error, hint, wrapperClassName, className, required, ...props }, ref) => {
    const id = React.useId();

    return (
      <div className={cn("form-group", wrapperClassName)}>
        <label 
          htmlFor={id} 
          className="label"
        >
          {label} {required && <span className="text-amber-500 ml-1">*</span>}
        </label>
        
        <div className="relative">
          <input
            {...props}
            ref={ref}
            id={id}
            className={cn(
              "input",
              error ? "input-error" : "",
              className
            )}
          />
        </div>

        {(hint || error) && (
          <p className={cn(
            "text-[9px] font-bold mt-1 uppercase tracking-wider",
            error ? "text-red-500" : "text-slate-400"
          )}>
            {error || hint}
          </p>
        )}
      </div>
    );
  }
);

FormGroup.displayName = "FormGroup";
