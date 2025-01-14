import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, PlayCircle } from "lucide-react";

interface ProjectCardActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  onStartAdWizard: () => void;
  hasCampaign: boolean;
}

const ProjectCardActions = ({ 
  onEdit, 
  onDelete, 
  onStartAdWizard,
  hasCampaign 
}: ProjectCardActionsProps) => {
  return (
    <CardFooter className="flex justify-end space-x-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onEdit}
      >
        <Edit2 className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onDelete}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <Button
        variant="default"
        className="gap-2"
        onClick={onStartAdWizard}
      >
        <PlayCircle className="h-4 w-4" />
        {hasCampaign ? "View Campaign" : "Create Campaign"}
      </Button>
    </CardFooter>
  );
};

export default ProjectCardActions;