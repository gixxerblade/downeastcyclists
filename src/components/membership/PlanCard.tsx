'use client';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
} from '@mui/material';

export interface MembershipPlan {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  stripePriceId: string;
}

interface PlanCardProps {
  plan: MembershipPlan;
  selected: boolean;
  onSelect: (planId: string, stripePriceId: string) => void;
  disabled?: boolean;
}

export function PlanCard({plan, selected, onSelect, disabled}: PlanCardProps) {
  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: selected ? '2px solid' : '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'primary.light',
          boxShadow: 2,
        },
      }}
    >
      <CardContent sx={{flexGrow: 1}}>
        <Typography variant="h5" component="h3" gutterBottom fontWeight="bold">
          {plan.name}
        </Typography>

        <Box sx={{mb: 2}}>
          <Typography variant="h4" component="span" color="primary" fontWeight="bold">
            ${plan.price}
          </Typography>
          <Typography variant="body2" component="span" color="text.secondary">
            /year
          </Typography>
        </Box>

        <List dense disablePadding>
          {plan.benefits.map((benefit, index) => (
            <ListItem key={index} disableGutters sx={{py: 0.5}}>
              <ListItemIcon sx={{minWidth: 32}}>
                <CheckCircleIcon color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={benefit} primaryTypographyProps={{variant: 'body2'}} />
            </ListItem>
          ))}
        </List>
      </CardContent>

      <CardActions sx={{p: 2, pt: 0}}>
        <Button
          fullWidth
          variant={selected ? 'contained' : 'outlined'}
          color="primary"
          onClick={() => onSelect(plan.id, plan.stripePriceId)}
          disabled={disabled}
        >
          {selected ? 'Selected' : 'Select Plan'}
        </Button>
      </CardActions>
    </Card>
  );
}
