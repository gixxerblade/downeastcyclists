'use client';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import {Schema} from 'effect';

import {WaiverSignatureInput} from '@/src/lib/waivers/schemas';
import {validateWaiverSignature, waiverConsent} from '@/src/lib/waivers/signature';

export interface WaiverSignatureDraft {
  signerRole: 'adult' | 'household';
  signerName: string;
  signerBirthDate: string;
  familyMembers: Array<{name: string; birthDate: string}>;
  previousSignatureId?: string;
  phone: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  signatureText: string;
  consent: boolean;
}

export function makeWaiverSignatureDraft(name = '', household = false): WaiverSignatureDraft {
  return {
    signerRole: household ? 'household' : 'adult',
    signerName: name,
    signerBirthDate: '',
    familyMembers: [],
    phone: '',
    addressStreet: '',
    addressCity: '',
    addressState: 'NC',
    addressZip: '',
    signatureText: '',
    consent: false,
  };
}

export function parseWaiverDraft(
  draft: WaiverSignatureDraft,
): {input: WaiverSignatureInput; error?: never} | {error: string; input?: never} {
  const decoded = Schema.decodeUnknownEither(WaiverSignatureInput)(draft);
  if (decoded._tag === 'Left')
    return {
      error: 'Please complete every required waiver field and agree to the signature statement.',
    };
  const error = validateWaiverSignature(decoded.right);
  return error ? {error} : {input: decoded.right};
}

interface WaiverSignatureFieldsProps {
  readonly title: string;
  readonly version: number;
  readonly content: string;
  readonly acknowledgment: string;
  readonly value: WaiverSignatureDraft;
  readonly onChange: (value: WaiverSignatureDraft) => void;
  readonly requireHousehold?: boolean;
  readonly disabled?: boolean;
  readonly error?: string | null;
}

export function WaiverSignatureFields({
  title,
  version,
  content,
  acknowledgment,
  value,
  onChange,
  requireHousehold = false,
  disabled = false,
  error,
}: WaiverSignatureFieldsProps) {
  const update = <K extends keyof WaiverSignatureDraft>(field: K, next: WaiverSignatureDraft[K]) =>
    onChange({...value, [field]: next, consent: false});
  const household = value.signerRole === 'household';
  return (
    <Box sx={{display: 'grid', gap: 3}}>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Box>
        <Typography variant="h4" component="h2">
          {title}
        </Typography>
        <Typography color="text.secondary">Version {version}</Typography>
      </Box>
      <Box
        tabIndex={0}
        aria-label="Waiver terms"
        sx={{
          border: '1px solid var(--dec-border)',
          borderRadius: 1,
          bgcolor: 'background.paper',
          p: {xs: 2, md: 3},
          maxHeight: 390,
          overflowY: 'auto',
          whiteSpace: 'pre-wrap',
          fontFamily: 'Georgia, serif',
          fontSize: 14,
          lineHeight: 1.65,
        }}
      >
        {content}
      </Box>
      <FormControl disabled={disabled || requireHousehold}>
        <FormLabel id="signer-role-label">Who are you signing for?</FormLabel>
        <RadioGroup
          row
          aria-labelledby="signer-role-label"
          value={value.signerRole}
          onChange={(event) =>
            onChange({
              ...value,
              signerRole: event.target.value === 'household' ? 'household' : 'adult',
              familyMembers: [],
              signatureText: '',
              consent: false,
            })
          }
        >
          <FormControlLabel value="adult" control={<Radio />} label="Myself" />
          <FormControlLabel value="household" control={<Radio />} label="Myself and my family" />
        </RadioGroup>
      </FormControl>
      <Typography variant="h6" component="h3">
        {household ? 'Head of household / initial member' : 'Your details'}
      </Typography>
      <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'}, gap: 2}}>
        <TextField
          required
          label="Your full legal name"
          value={value.signerName}
          onChange={(event) => update('signerName', event.target.value)}
          disabled={disabled}
        />
        <TextField
          required
          type="date"
          label="Your birth date"
          InputLabelProps={{shrink: true}}
          value={value.signerBirthDate}
          onChange={(event) => update('signerBirthDate', event.target.value)}
          disabled={disabled}
          helperText="The person signing must be 18 or older."
        />
        <TextField
          required
          type="tel"
          label="Phone"
          value={value.phone}
          onChange={(event) => update('phone', event.target.value)}
          disabled={disabled}
        />
        <TextField
          required
          label="Street address"
          value={value.addressStreet}
          onChange={(event) => update('addressStreet', event.target.value)}
          disabled={disabled}
        />
        <TextField
          required
          label="City"
          value={value.addressCity}
          onChange={(event) => update('addressCity', event.target.value)}
          disabled={disabled}
        />
        <Box sx={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2}}>
          <TextField
            required
            label="State"
            value={value.addressState}
            onChange={(event) => update('addressState', event.target.value)}
            disabled={disabled}
          />
          <TextField
            required
            label="ZIP code"
            value={value.addressZip}
            onChange={(event) => update('addressZip', event.target.value)}
            disabled={disabled}
          />
        </Box>
      </Box>
      {household ? (
        <Box sx={{display: 'grid', gap: 2}}>
          <Typography variant="h6" component="h3">
            Family members
          </Typography>
          <Typography variant="body2">
            You are already included. Add the full name and birth date of everyone else in your
            family. You will sign once for everyone listed.
          </Typography>
          {value.familyMembers.map((member, index) => (
            <Box
              key={index}
              component="fieldset"
              sx={{m: 0, p: 2, border: '1px solid var(--dec-border)', borderRadius: 1}}
            >
              <Typography component="legend">Family member {index + 1}</Typography>
              <Box sx={{display: 'grid', gridTemplateColumns: {xs: '1fr', sm: '1fr 1fr'}, gap: 2}}>
                <TextField
                  required
                  label={`Family member ${index + 1} full name`}
                  value={member.name}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      'familyMembers',
                      value.familyMembers.map((item, i) =>
                        i === index ? {...item, name: event.target.value} : item,
                      ),
                    )
                  }
                />
                <TextField
                  required
                  type="date"
                  label={`Family member ${index + 1} birth date`}
                  InputLabelProps={{shrink: true}}
                  value={member.birthDate}
                  disabled={disabled}
                  onChange={(event) =>
                    update(
                      'familyMembers',
                      value.familyMembers.map((item, i) =>
                        i === index ? {...item, birthDate: event.target.value} : item,
                      ),
                    )
                  }
                />
              </Box>
              <Button
                type="button"
                color="error"
                disabled={disabled}
                onClick={() =>
                  update(
                    'familyMembers',
                    value.familyMembers.filter((_, i) => i !== index),
                  )
                }
                aria-label={`Remove family member ${index + 1}`}
                sx={{mt: 1}}
              >
                Remove
              </Button>
            </Box>
          ))}
          <Button
            type="button"
            variant="outlined"
            disabled={disabled || value.familyMembers.length >= 49}
            onClick={() =>
              update('familyMembers', [...value.familyMembers, {name: '', birthDate: ''}])
            }
          >
            Add family member
          </Button>
          <Typography variant="body2" fontWeight={700}>
            {value.familyMembers.length + 1} {value.familyMembers.length ? 'people' : 'person'}{' '}
            included in this waiver
          </Typography>
        </Box>
      ) : null}
      <Box sx={{borderTop: '1px solid var(--dec-border)', pt: 3}}>
        <Typography variant="h6" component="h3" sx={{mb: 2}}>
          {household ? 'One signature for your household' : 'Electronic signature'}
        </Typography>
        <TextField
          required
          fullWidth
          autoComplete="off"
          label="Type your full legal name to sign"
          value={value.signatureText}
          onChange={(event) => update('signatureText', event.target.value)}
          disabled={disabled}
        />
        <FormControlLabel
          sx={{alignItems: 'flex-start', mt: 2}}
          control={
            <Checkbox
              required
              checked={value.consent}
              onChange={(event) => onChange({...value, consent: event.target.checked})}
              disabled={disabled}
            />
          }
          label={`${acknowledgment} ${waiverConsent(value.signerRole)}`}
        />
      </Box>
    </Box>
  );
}
