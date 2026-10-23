import * as React from "react";

import { cn } from "@/lib/utils";
import { controlClasses } from "@/components/ui/input";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(controlClasses, "h-control cursor-pointer pr-9", className)} {...props} />
));
Select.displayName = "Select";

export { Select };
