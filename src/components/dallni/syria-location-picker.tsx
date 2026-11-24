import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { DALLNI_COLORS } from '@/components/dallni/flow-ui';
import {
  formatSyriaLocationForLanguage,
  getSyriaLocation,
  getSyriaLocationChildren,
  getSyriaLocationName,
  getSyriaLocationPath,
  searchSyriaLocalities,
  SYRIA_LOCATION_LEVEL_LABELS,
  type SyriaLocationLevel,
  type SyriaLocation,
} from '@/utils/syria-locations';

type SyriaLocationPickerProps = {
  label: string;
  value: string;
  onChange: (locationId: string) => void;
  disabled?: boolean;
  language?: 'ar' | 'en';
};

export function SyriaLocationPicker(props: SyriaLocationPickerProps) {
  return <SyriaLocationPickerForm key={props.value} {...props} />;
}

function SyriaLocationPickerForm({ label, value, onChange, disabled = false, language = 'ar' }: SyriaLocationPickerProps) {
  const selectedPath = getSyriaLocationPath(value);
  const [isOpen, setIsOpen] = useState(false);
  const [governorateId, setGovernorateId] = useState(() => selectedPath.find((location) => location.level === 'governorate')?.id ?? '');
  const [districtId, setDistrictId] = useState(() => selectedPath.find((location) => location.level === 'district')?.id ?? '');
  const [subdistrictId, setSubdistrictId] = useState(() => selectedPath.find((location) => location.level === 'subdistrict')?.id ?? '');
  const [localityId, setLocalityId] = useState(() => selectedPath.find((location) => location.level === 'locality')?.id ?? '');
  const [localitySearch, setLocalitySearch] = useState('');

  const districts = getSyriaLocationChildren(governorateId).filter((item) => item.level === 'district');
  const subdistricts = getSyriaLocationChildren(districtId).filter((item) => item.level === 'subdistrict');
  const localities = subdistrictId ? searchSyriaLocalities(subdistrictId, localitySearch) : [];

  function chooseLocation(location: SyriaLocation) {
    onChange(location.id);
    setIsOpen(false);
  }

  function chooseGovernorate(id: string) {
    setGovernorateId(id);
    setDistrictId('');
    setSubdistrictId('');
    setLocalityId('');
  }

  function chooseDistrict(id: string) {
    setDistrictId(id);
    setSubdistrictId('');
    setLocalityId('');
  }

  function chooseSubdistrict(id: string) {
    setSubdistrictId(id);
    setLocalityId('');
    setLocalitySearch('');
  }

  const selectedGovernorate = getSyriaLocation(governorateId);
  const selectedDistrict = getSyriaLocation(districtId);
  const selectedSubdistrict = getSyriaLocation(subdistrictId);
  const selectedLocality = getSyriaLocation(localityId);
  const copy = language === 'ar'
    ? {
        hide: 'إخفاء', choose: 'اختيار', governorate: 'اختر المحافظة', district: 'اختر المدينة أو المنطقة',
        subdistrict: 'اختر الناحية', search: 'ابحث عن بلدة أو قرية', localityA11y: 'ابحث عن بلدة أو قرية سورية',
        placeholder: 'اكتب اسم البلدة أو القرية', empty: 'ما لقينا بلدة أو قرية بهالاسم ضمن الناحية المختارة.',
        hint: 'اختر المحافظة، ثم المدينة أو المنطقة، والناحية، والبلدة أو القرية. فيك تعتمد أي مستوى حسب نطاق الخدمة.',
        levels: SYRIA_LOCATION_LEVEL_LABELS,
      }
    : {
        hide: 'Hide', choose: 'Choose', governorate: 'Choose a governorate', district: 'Choose a city or district',
        subdistrict: 'Choose a subdistrict', search: 'Search for a town or village', localityA11y: 'Search Syrian towns and villages',
        placeholder: 'Type a town or village name', empty: 'No town or village with that name in the selected subdistrict.',
        hint: 'Choose a governorate, then a city or district, subdistrict, and town or village. You can select a broader area when it fits your service range.',
        levels: {
          governorate: 'governorate',
          district: 'city or district',
          subdistrict: 'subdistrict',
          locality: 'town or village',
        } satisfies Record<SyriaLocationLevel, string>,
      };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || false, expanded: isOpen }}
        disabled={disabled}
        onPress={() => setIsOpen((current) => !current)}
        style={({ pressed }) => [styles.selected, pressed && !disabled && styles.pressed]}>
        <Text style={[styles.selectedValue, !value && styles.placeholder, language === 'en' && styles.englishText]}>{formatSyriaLocationForLanguage(value, language)}</Text>
        <Text style={styles.changeText}>{isOpen ? copy.hide : copy.choose}</Text>
      </Pressable>

      {isOpen && !disabled ? (
        <View style={styles.picker}>
          <Text style={[styles.stepLabel, language === 'en' && styles.englishText]}>{language === 'ar' ? '١. ' : '1. '}{copy.governorate}</Text>
          <View style={styles.options}>
            {getSyriaLocationChildren().map((governorate) => (
              <LocationOption
                key={governorate.id}
                location={governorate}
                language={language}
                selected={governorateId === governorate.id}
                onPress={() => chooseGovernorate(governorate.id)}
              />
            ))}
          </View>
          {selectedGovernorate ? (
            <>
              <CommitLocationButton location={selectedGovernorate} onPress={() => chooseLocation(selectedGovernorate)} language={language} levelLabel={copy.levels.governorate} />
              <Text style={[styles.stepLabel, language === 'en' && styles.englishText]}>{language === 'ar' ? '٢. ' : '2. '}{copy.district}</Text>
              <View style={styles.options}>
                {districts.map((district) => (
                  <LocationOption
                    key={district.id}
                    location={district}
                    language={language}
                    selected={districtId === district.id}
                    onPress={() => chooseDistrict(district.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {selectedDistrict ? (
            <>
              <CommitLocationButton location={selectedDistrict} onPress={() => chooseLocation(selectedDistrict)} language={language} levelLabel={copy.levels.district} />
              <Text style={[styles.stepLabel, language === 'en' && styles.englishText]}>{language === 'ar' ? '٣. ' : '3. '}{copy.subdistrict}</Text>
              <View style={styles.options}>
                {subdistricts.map((subdistrict) => (
                  <LocationOption
                    key={subdistrict.id}
                    location={subdistrict}
                    language={language}
                    selected={subdistrictId === subdistrict.id}
                    onPress={() => chooseSubdistrict(subdistrict.id)}
                  />
                ))}
              </View>
            </>
          ) : null}
          {selectedSubdistrict ? (
            <>
              <CommitLocationButton location={selectedSubdistrict} onPress={() => chooseLocation(selectedSubdistrict)} language={language} levelLabel={copy.levels.subdistrict} />
              <Text style={[styles.stepLabel, language === 'en' && styles.englishText]}>{language === 'ar' ? '٤. ' : '4. '}{copy.search}</Text>
              <TextInput
                accessibilityLabel={copy.localityA11y}
                autoCorrect={false}
                onChangeText={setLocalitySearch}
                placeholder={copy.placeholder}
                placeholderTextColor={DALLNI_COLORS.muted}
                style={[styles.searchInput, language === 'en' && styles.englishText]}
                textAlign={language === 'ar' ? 'right' : 'left'}
                value={localitySearch}
              />
              {selectedLocality ? (
                <CommitLocationButton location={selectedLocality} onPress={() => chooseLocation(selectedLocality)} language={language} levelLabel={copy.levels.locality} />
              ) : null}
              <View style={styles.options}>
                {localities.map((locality) => (
                  <LocationOption
                    key={locality.id}
                    location={locality}
                    language={language}
                    selected={localityId === locality.id}
                    onPress={() => setLocalityId(locality.id)}
                  />
                ))}
              </View>
              {localitySearch.trim() && localities.length === 0 ? (
                <Text style={[styles.emptyText, language === 'en' && styles.englishText]}>{copy.empty}</Text>
              ) : null}
            </>
          ) : null}
          <Text style={[styles.hint, language === 'en' && styles.englishText]}>{copy.hint}</Text>
        </View>
      ) : null}
    </View>
  );
}

function LocationOption({ location, selected, onPress, language }: { location: SyriaLocation; selected: boolean; onPress: () => void; language: 'ar' | 'en' }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}>
      <Text style={[styles.optionText, selected && styles.optionTextSelected, language === 'en' && styles.englishText]}>{getSyriaLocationName(location, language)}</Text>
    </Pressable>
  );
}

function CommitLocationButton({ location, onPress, language, levelLabel }: { location: SyriaLocation; onPress: () => void; language: 'ar' | 'en'; levelLabel: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.commitButton, pressed && styles.pressed]}>
      <Text style={[styles.commitText, language === 'en' && styles.englishText]}>{language === 'ar' ? `اعتماد ${levelLabel}: ${location.name}` : `Select ${levelLabel}: ${getSyriaLocationName(location, language)}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: { color: DALLNI_COLORS.ink, fontSize: 12, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  selected: { alignItems: 'center', backgroundColor: '#F5F8F6', borderColor: DALLNI_COLORS.border, borderRadius: 13, borderWidth: 1, flexDirection: 'row-reverse', gap: 8, justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 12, paddingVertical: 9 },
  selectedValue: { color: DALLNI_COLORS.ink, flex: 1, fontSize: 12, lineHeight: 19, textAlign: 'right', writingDirection: 'rtl' },
  placeholder: { color: DALLNI_COLORS.muted },
  changeText: { color: DALLNI_COLORS.green, fontSize: 11, fontWeight: '900' },
  picker: { backgroundColor: '#FAFCFB', borderColor: DALLNI_COLORS.border, borderRadius: 14, borderWidth: 1, gap: 9, padding: 10 },
  stepLabel: { color: DALLNI_COLORS.ink, fontSize: 11, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  options: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  option: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 12, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
  optionSelected: { backgroundColor: '#E5F4EB', borderColor: DALLNI_COLORS.green },
  optionText: { color: DALLNI_COLORS.ink, fontSize: 10, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  optionTextSelected: { color: DALLNI_COLORS.greenDark, fontWeight: '900' },
  commitButton: { alignItems: 'flex-end', backgroundColor: '#EDF6F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  commitText: { color: DALLNI_COLORS.greenDark, fontSize: 10, fontWeight: '900', textAlign: 'right', writingDirection: 'rtl' },
  searchInput: { backgroundColor: '#FFFFFF', borderColor: DALLNI_COLORS.border, borderRadius: 11, borderWidth: 1, color: DALLNI_COLORS.ink, fontSize: 12, minHeight: 42, paddingHorizontal: 11, textAlign: 'right', writingDirection: 'rtl' },
  emptyText: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  hint: { color: DALLNI_COLORS.muted, fontSize: 10, lineHeight: 16, textAlign: 'right', writingDirection: 'rtl' },
  englishText: { textAlign: 'left', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
});
