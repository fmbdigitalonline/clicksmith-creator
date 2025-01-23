import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface RegistrationWallProps {
  onBack: () => void;
}

const RegistrationWall = ({ onBack }: RegistrationWallProps) => {
  const navigate = useNavigate();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create an Account to See Your Generated Ads</CardTitle>
        <CardDescription>
          You're just one step away from seeing your AI-generated ad campaigns.
          Create a free account to continue and save your progress.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">Why create an account?</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>See your AI-generated ad campaigns</li>
            <li>Save and manage multiple projects</li>
            <li>Download and export your ads</li>
            <li>Get access to advanced features</li>
          </ul>
        </div>
        <div className="flex gap-4 pt-4">
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
          <Button 
            onClick={() => navigate('/login')} 
            className="bg-facebook hover:bg-facebook/90"
          >
            Create Account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RegistrationWall;