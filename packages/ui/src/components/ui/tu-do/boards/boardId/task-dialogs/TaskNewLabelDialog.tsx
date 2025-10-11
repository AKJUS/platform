import { Loader2 } from '@tuturuuu/icons';
import { Badge } from '@tuturuuu/ui/badge';
import { Button } from '@tuturuuu/ui/button';
import { ColorPicker } from '@tuturuuu/ui/color-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@tuturuuu/ui/dialog';
import { Input } from '@tuturuuu/ui/input';
import { Label } from '@tuturuuu/ui/label';

interface TaskNewLabelDialogProps {
  open: boolean;
  newLabelName: string;
  newLabelColor: string;
  creatingLabel: boolean;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onConfirm: () => void;
}

export function TaskNewLabelDialog({
  open,
  newLabelName,
  newLabelColor,
  creatingLabel,
  onOpenChange,
  onNameChange,
  onColorChange,
  onConfirm,
}: TaskNewLabelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Label</DialogTitle>
          <DialogDescription>
            Add a new label to organize your tasks. Give it a descriptive name
            and choose a color.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Label Name</Label>
            <Input
              value={newLabelName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g., Bug, Feature, Priority"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabelName.trim()) {
                  onConfirm();
                }
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <ColorPicker value={newLabelColor} onChange={onColorChange} />
              <Badge
                style={{
                  backgroundColor: `color-mix(in srgb, ${newLabelColor} 15%, transparent)`,
                  borderColor: `color-mix(in srgb, ${newLabelColor} 30%, transparent)`,
                  color: newLabelColor,
                }}
                className="border"
              >
                {newLabelName.trim() || 'Preview'}
              </Badge>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={creatingLabel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={!newLabelName.trim() || creatingLabel}
          >
            {creatingLabel ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Label'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
