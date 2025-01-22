import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LikeDislikeButtonsProps {
  rating: number | null;
  onLike: () => void;
  onDislike: () => void;
  disabled?: boolean;
}

export const LikeDislikeButtons = ({
  rating,
  onLike,
  onDislike,
  disabled,
}: LikeDislikeButtonsProps) => {
  return (
    <div className="flex space-x-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onLike}
        disabled={disabled}
        className={cn(rating === 1 && "bg-green-100")}
      >
        <ThumbsUp className="w-4 h-4 mr-2" />
        Like
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onDislike}
        disabled={disabled}
        className={cn(rating === 0 && "bg-red-100")}
      >
        <ThumbsDown className="w-4 h-4 mr-2" />
        Dislike
      </Button>
    </div>
  );
};