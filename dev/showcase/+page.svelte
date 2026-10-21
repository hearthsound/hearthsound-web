<!--
  Component showcase (development only).

  A throwaway page that renders every component in `src/lib/ui` in its states,
  side by side in a light and a dark column, so a person can compare what the
  package ships against the components this app builds on top of it.

  This page is not part of the product: it is kept at `dev/showcase/`, outside
  SvelteKit's route tree, and `npm run dev` copies it to
  `src/routes/ui-preview/` (gitignored) while `npm run build` removes that
  directory again, so a release build never contains it. All names, numbers,
  paths and messages below are fixture text for layout comparison, not product
  copy.
-->
<script lang="ts">
  import AccountRow from '#lib/ui/AccountRow.svelte';
  import Avatar from '#lib/ui/Avatar.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import BoxedList from '#lib/ui/BoxedList.svelte';
  import Button from '#lib/ui/Button.svelte';
  import ButtonGroup from '#lib/ui/ButtonGroup.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import CountBadge from '#lib/ui/CountBadge.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import DropZone from '#lib/ui/DropZone.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import HealthIndicator from '#lib/ui/HealthIndicator.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import Lockup from '#lib/ui/Lockup.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuCheckItem from '#lib/ui/MenuCheckItem.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Mosaic from '#lib/ui/Mosaic.svelte';
  import NavHeading from '#lib/ui/NavHeading.svelte';
  import NavRow from '#lib/ui/NavRow.svelte';
  import NumberField from '#lib/ui/NumberField.svelte';
  import OverviewCard from '#lib/ui/OverviewCard.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import PlayButton from '#lib/ui/PlayButton.svelte';
  import PlaylistCard from '#lib/ui/PlaylistCard.svelte';
  import ProgressBar from '#lib/ui/ProgressBar.svelte';
  import Radio from '#lib/ui/Radio.svelte';
  import ReorderList from '#lib/ui/ReorderList.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Segmented from '#lib/ui/Segmented.svelte';
  import Select from '#lib/ui/Select.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import Slider from '#lib/ui/Slider.svelte';
  import Spinner from '#lib/ui/Spinner.svelte';
  import SplitButton from '#lib/ui/SplitButton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import Stepper from '#lib/ui/Stepper.svelte';
  import Switch from '#lib/ui/Switch.svelte';
  import Table from '#lib/ui/Table.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import Toast from '#lib/ui/Toast.svelte';
  import TopResultCard from '#lib/ui/TopResultCard.svelte';
  import Transport from '#lib/ui/Transport.svelte';
  import UploadItem from '#lib/ui/UploadItem.svelte';

  type Column = 'light' | 'dark';

  interface ReorderItem {
    id: string;
    name: string;
    detail: string;
  }

  /** A flat fixture cover, drawn as a data URI so the page needs no assets. */
  function cover(background: string, accent: string): string {
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">` +
      `<rect width="160" height="160" fill="${background}"/>` +
      `<circle cx="112" cy="48" r="34" fill="${accent}"/>` +
      `<path d="M0 128l46-38 36 28 26-20 52 44v18H0z" fill="${accent}" opacity="0.65"/>` +
      `</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  }

  const covers = [
    cover('#b08968', '#3d2b1f'),
    cover('#6f7d8c', '#1f2a33'),
    cover('#a3b18a', '#344e41'),
    cover('#c9a227', '#4a3b0a')
  ];

  const formatOptions = [
    { value: 'flac', label: 'FLAC (lossless)' },
    { value: 'mp3', label: 'MP3 320 kbps' },
    { value: 'ogg', label: 'Ogg Vorbis' }
  ];

  const speedItems = [
    { label: '0.5x', pressed: false },
    { label: '1x', pressed: true },
    { label: '1.5x', pressed: false },
    { label: '2x', pressed: false }
  ];

  const repeatItems = [
    { label: 'Off', pressed: true },
    { label: 'All', pressed: false },
    { label: 'One', pressed: false }
  ];

  const lyricsQueue = [
    { value: 'lyrics', label: 'Lyrics' },
    { value: 'queue', label: 'Queue' }
  ];

  const detailSegments = [
    { value: 'details', label: 'Details' },
    { value: 'credits', label: 'Credits' }
  ];

  const steps = ['Administrator', 'Music folders', 'Plugins', 'Configure', 'Order', 'Summary'];

  const tableColumns = [
    { key: 'folder', label: 'Folder' },
    { key: 'tracks', label: 'Tracks', numeric: true }
  ];

  let reorderItems = $state<ReorderItem[]>([
    { id: 'one', name: 'Fixture layer one', detail: 'Metadata' },
    { id: 'two', name: 'Fixture layer two', detail: 'Acoustics' },
    { id: 'three', name: 'Fixture layer three', detail: 'Covers' }
  ]);

  let reorderModeItems = $state<ReorderItem[]>([
    { id: 'mode-one', name: 'Fixture reorderable row one', detail: '' },
    { id: 'mode-two', name: 'Fixture reorderable row two', detail: '' }
  ]);

  let tableSort = $state<{ key: string; direction: 'ascending' | 'descending' } | null>({
    key: 'folder',
    direction: 'ascending'
  });

  let demoText = $state('Fixture album');
  let demoUrl = $state('https://fixture.test');
  let demoPassword = $state('correct horse battery staple');
  let demoSearch = $state('blue train');
  let demoTextArea = $state(
    'Fixture text that fills the three-line field.\nA second line of fixture text.'
  );
  let demoNumber = $state(4);
  let demoCache = $state(512);
  let demoCheckbox = $state(true);
  let demoSwitch = $state(true);
  let quality = $state('original');
  let demoFormat = $state('flac');
  let segmentedView = $state('lyrics');
  let detailView = $state('details');
  let seek = $state(83);
  let volume = $state(60);
  let dialogFolder = $state('Fixture folder');

  const menuOpen = $state<Record<Column, boolean>>({ light: false, dark: false });
  const dialogOpen = $state<Record<Column, 'action' | 'alert' | null>>({
    light: null,
    dark: null
  });

  /**
   * Reverses the table sort when the same column is chosen again.
   *
   * @param key The chosen column.
   */
  function sortBy(key: string): void {
    tableSort =
      tableSort?.key === key
        ? {
            key,
            direction: tableSort.direction === 'ascending' ? 'descending' : 'ascending'
          }
        : { key, direction: 'ascending' };
  }
</script>

<svelte:head>
  <title>Component showcase - Hearthsound</title>
</svelte:head>

<header class="intro">
  <p class="hs-caption intro-kicker">Development only</p>
  <h1 class="hs-title-2">Component showcase</h1>
  <p class="intro-text">
    Every component in <code class="hs-inline-code">src/lib/ui</code> in its states, with a light and
    a dark column for each group. All names, numbers, paths and messages here are fixture text for comparison,
    not product copy.
  </p>
  <p class="hs-caption">
    Throwaway page. It is excluded from git through .git/info/exclude and must never be committed.
  </p>
</header>

{#snippet stateLabel(text: string)}
  <p class="hs-caption state-label">{text}</p>
{/snippet}

{#snippet bannerActions()}
  <Button variant="flat">Retry</Button>
{/snippet}

{#snippet statusAction()}
  <Button variant="suggested">Try Again</Button>
{/snippet}

{#snippet pageActions()}
  <Button variant="flat" shape="icon" icon="adwaita-search" label="Search" />
  <Button variant="flat" shape="icon" icon="adwaita-more" label="More Actions" />
{/snippet}

{#snippet sectionActions()}
  <Button variant="flat" shape="icon" icon="adwaita-back" label="Scroll Left" />
  <Button variant="flat" shape="icon" icon="adwaita-forward" label="Scroll Right" />
{/snippet}

{#snippet albumActions()}
  <Button variant="suggested" icon="adwaita-play">Play</Button>
  <Button icon="adwaita-shuffle">Shuffle</Button>
  <Button variant="flat" shape="icon" icon="adwaita-more" label="More Actions" />
{/snippet}

{#snippet heroArt()}
  <img src={covers[0]} alt="" />
{/snippet}

{#snippet menuContents()}
  <MenuItem label="Add to Queue" icon="adwaita-queue" onselect={() => {}} />
  <MenuItem label="Add to Playlist" icon="adwaita-playlist" submenuLabel="Add to Playlist">
    {#snippet submenu()}
      <MenuItem label="New Playlist" icon="adwaita-add" onselect={() => {}} />
      <MenuItem label="Fixture Quiet Hours" onselect={() => {}} />
    {/snippet}
  </MenuItem>
  <MenuSeparator />
  <MenuCheckItem label="Sort by Recently Added" checked={true} onselect={() => {}} />
  <MenuCheckItem label="Sort by Title" checked={false} onselect={() => {}} />
  <MenuSeparator />
  <MenuItem label="Remove from Queue" icon="adwaita-delete" disabled onselect={() => {}} />
{/snippet}

{#snippet endlessRows()}
  <BoxedList label="Loaded fixture rows">
    <ListRow title="Fixture track one" subtitle="Fixture artist - 3:12" />
    <ListRow title="Fixture track two" subtitle="Fixture artist - 4:01" />
    <ListRow title="Fixture track three" subtitle="Fixture artist - 2:47" />
  </BoxedList>
{/snippet}

{#snippet endlessPlaceholders()}
  <div class="placeholder-rows">
    <Skeleton width="100%" height="60px" radius="row" />
    <Skeleton width="100%" height="60px" radius="row" />
  </div>
{/snippet}

{#snippet controlsDemo(key: Column)}
  <div class="state">
    {@render stateLabel('Button - tonal, suggested, destructive, flat')}
    <div class="row">
      <Button>Save</Button>
      <Button variant="suggested">Save Changes</Button>
      <Button variant="destructive">Delete</Button>
      <Button variant="flat">Cancel</Button>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Button - sizes, icons, pill and menu chevron')}
    <div class="row">
      <Button icon="adwaita-play">Play</Button>
      <Button size="large" icon="adwaita-add">Add to Queue</Button>
      <Button trailingIcon="adwaita-forward">Next</Button>
      <Button shape="pill">Pill Shape</Button>
      <Button menu>Menu Button</Button>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Button - pressed, busy, disabled and the icon-only shapes')}
    <div class="row">
      <Button pressed={true}>Pressed</Button>
      <Button busy>Saving</Button>
      <Button disabled>Unavailable</Button>
      <Button shape="circular" icon="adwaita-play" label="Play" />
      <Button shape="icon" icon="adwaita-more" label="More Actions" />
      <Button shape="split" icon="adwaita-expand" label="More options for Play" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('SplitButton - regular, busy, disabled, expanded')}
    <div class="row">
      <SplitButton actionLabel="Play" icon="adwaita-play" onaction={() => {}} onmenu={() => {}} />
      <SplitButton actionLabel="Play" busy onaction={() => {}} onmenu={() => {}} />
      <SplitButton actionLabel="Play" disabled onaction={() => {}} onmenu={() => {}} />
      <SplitButton actionLabel="Play" expanded onaction={() => {}} onmenu={() => {}} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('ButtonGroup - tonal and suggested')}
    <div class="row">
      <ButtonGroup label="Playback speed" items={speedItems} />
      <ButtonGroup label="Repeat mode" items={repeatItems} variant="suggested" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Segmented - regular and flush')}
    <div class="stack">
      <Segmented label="Lyrics or queue" segments={lyricsQueue} bind:value={segmentedView} />
      <Segmented
        label="Details or credits"
        segments={detailSegments}
        bind:value={detailView}
        flush
      />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Checkbox - unchecked, bound, checked, mixed, disabled')}
    <div class="row">
      <Checkbox label="Unchecked" checked={false} />
      <Checkbox label="Bound checkbox" bind:checked={demoCheckbox} />
      <Checkbox label="Checked" checked={true} />
      <Checkbox label="Mixed" checked={true} mixed={true} />
      <Checkbox label="Disabled" disabled />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Radio - one native group with a disabled entry')}
    <div class="row" role="radiogroup" aria-label="Fixture quality">
      <Radio name="quality-{key}" value="original" label="Original" bind:group={quality} />
      <Radio name="quality-{key}" value="high" label="High" bind:group={quality} />
      <Radio name="quality-{key}" value="low" label="Low" bind:group={quality} />
      <Radio name="quality-{key}" value="off" label="Disabled" bind:group={quality} disabled />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Switch - on, off, disabled')}
    <div class="row">
      <Switch label="Enable uploads" bind:checked={demoSwitch} />
      <Switch label="Off" checked={false} />
      <Switch label="Disabled" checked={true} disabled />
    </div>
  </div>
{/snippet}

<section id="controls" class="section">
  <h2 class="hs-title-3">Controls</h2>
  <p class="hs-caption section-note">
    Buttons, linked groups, segmented controls and the three choice controls.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render controlsDemo('light')}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render controlsDemo('dark')}
    </div>
  </div>
</section>

{#snippet fieldsDemo(key: Column)}
  {@const textId = `showcase-text-${key}`}
  {@const nickId = `showcase-nick-${key}`}
  {@const serverId = `showcase-server-${key}`}

  <div class="state">
    {@render stateLabel('TextField - text, url, password with a value, search with Clear')}
    <div class="stack">
      <TextField label="Display name" bind:value={demoText} />
      <TextField kind="url" label="Server address" bind:value={demoUrl} />
      <TextField kind="password" label="Password" bind:value={demoPassword} />
      <TextField kind="search" label="Search the library" bind:value={demoSearch} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('TextField - invalid, disabled and the sidebar search variant')}
    <div class="stack">
      <TextField label="Invalid field" value="Fixture value" invalid />
      <TextField label="Disabled field" value="Fixture value" disabled />
      <div class="sidebar-field">
        <TextField kind="search" sidebar placeholder="Search" bind:value={demoSearch} />
      </div>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('FormField - hint, optional, error and pinned value')}
    <div class="stack">
      <FormField label="Username" for={textId} hint="The name you sign in with.">
        <TextField id={textId} bind:value={demoText} aria-describedby="{textId}-hint" />
      </FormField>
      <FormField label="Nickname" for={nickId} optional>
        <TextField id={nickId} value="Fixture nickname" />
      </FormField>
      <FormField label="Server" for={serverId} error="Fixture error: the server did not answer.">
        <TextField
          id={serverId}
          value="http://fixture.test"
          invalid
          aria-describedby="{serverId}-error"
        />
      </FormField>
      <FormField
        label="Media folder"
        value="/srv/fixture/music"
        pinned="Set in the configuration file"
      />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('TextArea - filled, invalid, disabled')}
    <div class="stack">
      <TextArea label="Description" bind:value={demoTextArea} />
      <TextArea label="Invalid" value="Fixture text" invalid />
      <TextArea label="Disabled" value="Fixture text" disabled />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('NumberField - limits, unit, disabled')}
    <div class="stack">
      <NumberField label="Calls at once" bind:value={demoNumber} min={1} max={32} />
      <NumberField
        label="Cache size"
        bind:value={demoCache}
        min={0}
        max={4096}
        step={64}
        unit="MB"
        unitText="megabytes"
      />
      <NumberField label="Disabled" value={2} disabled />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Select - closed, open, invalid, disabled')}
    <div class="stack popover-space">
      <Select label="Format" options={formatOptions} bind:value={demoFormat} />
      <Select label="Open format" options={formatOptions} value="mp3" open />
      <Select label="Invalid format" options={formatOptions} value="flac" invalid />
      <Select label="Disabled format" options={formatOptions} value="mp3" disabled />
    </div>
  </div>
{/snippet}

<section id="fields" class="section">
  <h2 class="hs-title-3">Fields</h2>
  <p class="hs-caption section-note">
    Text, password, search, number, textarea and drop-down entry, with the form field wrapper.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render fieldsDemo('light')}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render fieldsDemo('dark')}
    </div>
  </div>
</section>

{#snippet displayDemo()}
  <div class="state">
    {@render stateLabel('Icon - default, 24 px, 40 px and labelled')}
    <div class="row">
      <Icon name="adwaita-play" />
      <Icon name="adwaita-warning" size={24} />
      <Icon name="adwaita-storage" size={40} />
      <Icon name="adwaita-error" label="Failed" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Avatar and Lockup - small, large and linked')}
    <div class="row tall">
      <Avatar />
      <Lockup />
      <Lockup large />
      <Lockup href="/" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Pill - neutral, accent, success, warning, error')}
    <div class="row">
      <Pill glyph="adwaita-queue" label="Waiting" />
      <Pill tone="accent" glyph="custom-upload" label="Uploading 42%" />
      <Pill tone="success" glyph="adwaita-check" label="Done" />
      <Pill tone="warning" glyph="adwaita-warning" label="Warning" />
      <Pill tone="error" glyph="adwaita-error" label="Failed" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('CountBadge and HealthIndicator - every state')}
    <div class="row">
      <CountBadge count={12} />
      <HealthIndicator state="success" label="Healthy" />
      <HealthIndicator state="warning" label="Degraded" />
      <HealthIndicator state="error" label="Unreachable" />
      <HealthIndicator state="neutral" label="Unknown" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Spinner - 16, 24 and 48 px')}
    <div class="row">
      <Spinner />
      <Spinner size={24} />
      <Spinner size={48} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('ProgressBar - determinate and indeterminate')}
    <div class="stack narrow">
      <ProgressBar label="Downloading" value={42} />
      <ProgressBar label="Scanning" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Skeleton - text, control, card and art radii')}
    <div class="row">
      <Skeleton width="160px" height="18px" />
      <Skeleton width="140px" height="36px" radius="control" />
      <Skeleton width="160px" height="120px" radius="card" />
      <Skeleton width="96px" height="96px" radius="art" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Mosaic - empty, one, two, three and four covers')}
    <div class="row">
      <span class="cover"><Mosaic /></span>
      <span class="cover"><Mosaic covers={[covers[0]]} /></span>
      <span class="cover"><Mosaic covers={[covers[0], covers[1]]} /></span>
      <span class="cover"><Mosaic covers={[covers[0], covers[1], covers[2]]} /></span>
      <span class="cover"><Mosaic {covers} /></span>
    </div>
  </div>
{/snippet}

<section id="display" class="section">
  <h2 class="hs-title-3">Display</h2>
  <p class="hs-caption section-note">
    Icons, identity, state labels, loading placeholders and the mosaic cover.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render displayDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render displayDemo()}
    </div>
  </div>
</section>

{#snippet feedbackDemo()}
  <div class="state">
    {@render stateLabel('Banner - warning, error, success and floating')}
    <div class="stack">
      <Banner level="warning" text="Fixture warning: the session ends in ten minutes." />
      <Banner level="error" text="Fixture error: the server did not answer.">
        {#snippet actions()}
          {@render bannerActions()}
        {/snippet}
      </Banner>
      <Banner level="success" text="Fixture success: the folder was added." />
      <Banner level="warning" floating text="Fixture floating warning." />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Toast - success, warning and error; persistent preview')}
    <div class="stack">
      <Toast message="Fixture: added to the queue." duration={0} onclose={() => {}} />
      <Toast
        message="Fixture: the connection is slow."
        level="warning"
        onclose={() => {}}
        duration={0}
        newest={false}
      />
      <Toast message="Fixture: the upload failed." level="error" onclose={() => {}} duration={0} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('StatusPage - page, inline and alert with an action')}
    <div class="stack wide">
      <StatusPage
        icon="adwaita-playlist"
        title="Nothing Has Been Played Yet"
        text="Fixture explanation for an empty page."
      />
      <StatusPage
        icon="adwaita-song"
        title="No Songs Here"
        text="Fixture inline explanation."
        inline
        level={2}
      />
      <StatusPage
        alert
        icon="adwaita-warning"
        title="Could Not Load This Page"
        text="Fixture failure explanation."
        level={2}
      >
        {#snippet action()}
          {@render statusAction()}
        {/snippet}
      </StatusPage>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('UploadItem - waiting, uploading, processing, done, failed')}
    <div class="stack wide">
      <UploadItem name="fixture-track-one.flac" size="42.6 MB" state="queued" />
      <UploadItem name="fixture-track-two.flac" size="38.1 MB" state="uploading" progress={68} />
      <UploadItem name="fixture-track-three.flac" size="51.0 MB" state="processing" />
      <UploadItem name="fixture-track-four.flac" size="27.4 MB" state="done" />
      <UploadItem
        name="fixture-track-five.flac"
        size="33.9 MB"
        state="failed"
        reason="the fixture server rejected the file"
      />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('EndlessLoader - loading placeholders and the true end')}
    <div class="stack wide">
      <EndlessLoader onmore={() => {}} busy>
        {@render endlessRows()}
        {@render endlessPlaceholders()}
      </EndlessLoader>
      <EndlessLoader onmore={() => {}} done>
        {@render endlessRows()}
      </EndlessLoader>
    </div>
  </div>
{/snippet}

<section id="feedback" class="section">
  <h2 class="hs-title-3">Feedback</h2>
  <p class="hs-caption section-note">
    Banners, toasts, status pages, the upload row and endless loading.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render feedbackDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render feedbackDemo()}
    </div>
  </div>
</section>

{#snippet collectionsDemo()}
  <div class="state">
    {@render stateLabel('BoxedList and ListRow - setting, value, property, button, expander')}
    <BoxedList label="Fixture settings">
      <ListRow
        title="Enable uploads"
        subtitle="Fixture subtitle for a two-line row."
        setting="fixture.uploads"
        interactive
      >
        <Switch label="Enable uploads" checked={true} />
      </ListRow>
      <ListRow title="Cache size" value="512 MB" />
      <ListRow title="Media folder" value="/srv/fixture/music" property />
      <ListRow
        title="Pinned row"
        subtitle="Fixture subtitle."
        pinned="Set in the configuration file"
      />
      <ListRow title="Add music folder" button icon="adwaita-add" onclick={() => {}} />
      <ListRow title="Advanced" expander interactive expanded={true} onclick={() => {}} />
      <ListRow
        title="Collapsed expander"
        expander
        interactive
        expanded={false}
        onclick={() => {}}
      />
      <ListRow title="Nested fixture row" nested compact subtitle="Fixture subtitle." />
      <ListRow title="Disabled row" disabled subtitle="Unavailable in this state." />
      <ListRow title="Open the library" href="/library/albums" subtitle="A link row." />
    </BoxedList>
  </div>

  <div class="state">
    {@render stateLabel('Table - sortable headers, numeric column and a sorted header')}
    <Table label="Fixture folders" columns={tableColumns} sort={tableSort} onsort={sortBy}>
      <tr>
        <td>Fixture music</td>
        <td class="hs-table__cell--numeric">4812</td>
      </tr>
      <tr>
        <td>Fixture audiobooks</td>
        <td class="hs-table__cell--numeric">318</td>
      </tr>
      <tr>
        <td>Fixture imports</td>
        <td class="hs-table__cell--numeric">27</td>
      </tr>
    </Table>
  </div>

  <div class="state">
    {@render stateLabel('ReorderList - numbered rows with always-on handles')}
    <ReorderList label="Fixture layer order" bind:items={reorderItems} handles="always" twoLine>
      {#snippet children(item, position)}
        <span class="hs-setting-row__text">
          <span>{item.name}</span>
          <span class="hs-setting-row__subtitle">{item.detail} - position {position + 1}</span>
        </span>
      {/snippet}
    </ReorderList>
  </div>

  <div class="state">
    {@render stateLabel('ReorderList - reorder mode with handles and the Done command')}
    <ReorderList
      label="Fixture mode order"
      bind:items={reorderModeItems}
      handles="mode"
      reordering={true}
      numbered={false}
      ondone={() => {}}
    >
      {#snippet children(item, position)}
        <span class="hs-setting-row__text">
          <span>{item.name} - slot {position + 1}</span>
        </span>
      {/snippet}
    </ReorderList>
  </div>
{/snippet}

<section id="collections" class="section">
  <h2 class="hs-title-3">Collections</h2>
  <p class="hs-caption section-note">Boxed rows, the admin table and the reorderable list.</p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render collectionsDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render collectionsDemo()}
    </div>
  </div>
</section>

{#snippet cardsDemo()}
  <div class="state">
    {@render stateLabel('OverviewCard - a key number and a state body')}
    <div class="card-grid">
      <OverviewCard
        area="Users"
        icon="adwaita-users"
        href="/admin/users"
        value="3"
        line="3 administrators"
      />
      <OverviewCard
        area="Plugins"
        icon="adwaita-plugin"
        href="/admin/plugins"
        line="No plugins installed"
      >
        <Pill tone="warning" glyph="adwaita-warning" label="Needs attention" />
      </OverviewCard>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('PlaylistCard - four covers, one cover and the empty mosaic')}
    <div class="card-grid">
      <PlaylistCard name="Fixture Quiet Hours" songs={12} href="/playlist/1" {covers} />
      <PlaylistCard name="Fixture Train Ride" songs={1} href="/playlist/2" covers={[covers[2]]} />
      <PlaylistCard name="Fixture Empty" songs={0} href="/playlist/3" />
      <PlaylistCard
        name="Fixture Playable"
        songs={7}
        href="/playlist/4"
        covers={[covers[1], covers[3]]}
        onplay={() => {}}
      />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('TopResultCard - with art, with a placeholder, with Play')}
    <div class="card-grid">
      <TopResultCard
        name="Fixture Blue Hour"
        kind="Album"
        artist="Fixture Marlowe Fenn"
        href="/album/1"
        art={covers[0]}
      />
      <TopResultCard
        name="Fixture Unknown"
        kind="Album"
        artist="Fixture Marlowe Fenn"
        href="/album/2"
      />
      <TopResultCard
        name="Fixture Playable"
        kind="Album"
        artist="Fixture Marlowe Fenn"
        href="/album/3"
        art={covers[3]}
        onplay={() => {}}
      />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Shelf - section header with scroll actions and cards')}
    <Shelf title="Fixture Recently Added" href="/library/albums">
      <PlaylistCard name="Fixture One" songs={4} href="/playlist/1" covers={[covers[0]]} />
      <PlaylistCard name="Fixture Two" songs={8} href="/playlist/2" covers={[covers[1]]} />
      <PlaylistCard name="Fixture Three" songs={2} href="/playlist/3" covers={[covers[2]]} />
      <PlaylistCard name="Fixture Four" songs={6} href="/playlist/4" covers={[covers[3]]} />
    </Shelf>
  </div>

  <div class="state">
    {@render stateLabel('Hero - album with artwork, artist portrait with biography')}
    <div class="stack wide">
      <Hero
        title="Fixture Blue Train"
        by="Fixture John Coltrane"
        meta={['1957 - 5 songs - 42 min']}
        artAlt=""
        artwork={heroArt}
      >
        {#snippet actions()}
          {@render albumActions()}
        {/snippet}
      </Hero>
      <Hero
        title="Fixture Marlowe Fenn"
        round
        meta={['Fixture artist - 4 albums']}
        bio="Fixture biography text. It is long enough to pass the three-line clamp so the Show more disclosure appears in place, as the component intends."
      />
    </div>
  </div>
{/snippet}

<section id="cards" class="section">
  <h2 class="hs-title-3">Cards</h2>
  <p class="hs-caption section-note">
    Admin overview, playlist and top-result cards, the shelf and the detail hero.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render cardsDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render cardsDemo()}
    </div>
  </div>
</section>

{#snippet shellDemo()}
  <div class="state">
    {@render stateLabel('PageHeader - top-level with actions, scrolled, back and drawer')}
    <div class="stack wide">
      <div class="border">
        <PageHeader title="Fixture Albums">
          {#snippet actions()}
            {@render pageActions()}
          {/snippet}
        </PageHeader>
      </div>
      <div class="border">
        <PageHeader title="Fixture Scrolled" scrolled>
          {#snippet actions()}
            {@render pageActions()}
          {/snippet}
        </PageHeader>
      </div>
      <div class="border">
        <PageHeader title="Fixture Album" onback={() => {}} />
      </div>
      <div class="border">
        <PageHeader title="Fixture Top Level" onnavigation={() => {}} />
      </div>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('SectionHeader - linked, static and with actions')}
    <div class="stack wide">
      <SectionHeader title="Fixture Recently Added" href="/library/albums" />
      <SectionHeader title="Fixture Static Heading" level={3} />
      <SectionHeader title="Fixture With Actions" href="/library/albums">
        {#snippet actions()}
          {@render sectionActions()}
        {/snippet}
      </SectionHeader>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('NavHeading and NavRow - current row, count badge and plain row')}
    <div class="stack narrow">
      <NavHeading text="Fixture Library" id="fixture-nav-library" />
      <NavRow href="/library/albums" icon="adwaita-album" label="Albums" current />
      <NavRow href="/library/artists" icon="adwaita-artist" label="Artists" count={24} />
      <NavRow href="/library/songs" icon="adwaita-song" label="Songs" />
      <NavRow href="/library/albums" icon="adwaita-storage" label="Storage" />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('AccountRow - closed and expanded')}
    <div class="row">
      <AccountRow displayName="Fixture User" expanded={false} onclick={() => {}} />
      <AccountRow displayName="Fixture User" expanded={true} onclick={() => {}} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Stepper - early step and final step')}
    <div class="stack wide">
      <Stepper {steps} current={2} />
      <Stepper {steps} current={6} />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('DropZone - audio panel, small, dragging and disabled')}
    <div class="stack wide">
      <DropZone onfiles={() => {}} />
      <DropZone
        small
        icon="adwaita-plugin"
        label="Fixture plugin archive"
        hint="Drop the fixture archive here, or choose it."
        buttonLabel="Choose file"
        accept=".fixture"
        multiple={false}
        suggested={false}
        onfiles={() => {}}
      />
      <DropZone dragging onfiles={() => {}} />
      <DropZone disabled onfiles={() => {}} />
    </div>
  </div>
{/snippet}

<section id="shell" class="section">
  <h2 class="hs-title-3">Shell</h2>
  <p class="hs-caption section-note">
    Page headers, section headings, sidebar rows, the account row, the stepper and the drop panel.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render shellDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render shellDemo()}
    </div>
  </div>
</section>

{#snippet mediaDemo()}
  <div class="state">
    {@render stateLabel('PlayButton - play, pause, fetching, retry, large, disabled')}
    <div class="row">
      <PlayButton state="play" onclick={() => {}} />
      <PlayButton state="pause" onclick={() => {}} />
      <PlayButton state="fetching" />
      <PlayButton state="retry" onclick={() => {}} />
      <PlayButton state="play" large onclick={() => {}} />
      <PlayButton state="pause" disabled />
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Transport - player bar and large now-playing layout')}
    <div class="stack">
      <Transport label="Fixture transport">
        <Button
          variant="flat"
          shape="circular"
          icon="adwaita-shuffle"
          label="Shuffle On"
          pressed={true}
        />
        <Button variant="flat" shape="circular" icon="adwaita-previous" label="Previous" />
        <PlayButton state="pause" onclick={() => {}} />
        <Button variant="flat" shape="circular" icon="adwaita-next" label="Next" />
        <Button
          variant="flat"
          shape="circular"
          icon="adwaita-repeat"
          label="Repeat Off"
          pressed={false}
        />
      </Transport>
      <Transport large label="Fixture large transport">
        <Button variant="flat" shape="circular" icon="adwaita-previous" label="Previous" />
        <PlayButton state="play" large onclick={() => {}} />
        <Button variant="flat" shape="circular" icon="adwaita-next" label="Next" />
      </Transport>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Slider - seek with buffer, volume, disabled')}
    <div class="stack">
      <Slider
        kind="seek"
        label="Seek"
        bind:value={seek}
        max={214}
        buffer={190}
        valuetext="1 minute 23 seconds of 3 minutes 34 seconds"
      />
      <Slider kind="volume" label="Volume" bind:value={volume} />
      <Slider kind="seek" label="Disabled seek" value={40} max={214} disabled />
    </div>
  </div>
{/snippet}

<section id="media" class="section">
  <h2 class="hs-title-3">Media</h2>
  <p class="hs-caption section-note">The play disc, the transport row and the two slider kinds.</p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render mediaDemo()}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render mediaDemo()}
    </div>
  </div>
</section>

{#snippet overlaysDemo(key: Column)}
  <div class="state">
    {@render stateLabel('Menu - choose the trigger to inspect items, submenu and checks')}
    <div class="row menu-row">
      <Menu label="More Actions" menuLabel="Fixture song actions" bind:open={menuOpen[key]}>
        {@render menuContents()}
      </Menu>
      <span class="hs-caption">Menu trigger, then the grouped items.</span>
    </div>
  </div>

  <div class="state">
    {@render stateLabel('Dialog - action dialog and alert dialog')}
    <div class="row">
      <Button variant="suggested" onclick={() => (dialogOpen[key] = 'action')}>
        Open action dialog
      </Button>
      <Button variant="destructive" onclick={() => (dialogOpen[key] = 'alert')}>
        Open alert dialog
      </Button>
    </div>

    {#if dialogOpen[key] === 'action'}
      <Dialog title="Fixture Add Folder" onclose={() => (dialogOpen[key] = null)}>
        {#snippet footer()}
          <Button onclick={() => (dialogOpen[key] = null)}>Cancel</Button>
          <Button variant="suggested" onclick={() => (dialogOpen[key] = null)}>Add Folder</Button>
        {/snippet}
        <FormField
          label="Folder path"
          for={`showcase-dialog-${key}`}
          hint="Fixture hint text under the control."
        >
          <TextField
            id={`showcase-dialog-${key}`}
            bind:value={dialogFolder}
            aria-describedby={`showcase-dialog-${key}-hint`}
          />
        </FormField>
      </Dialog>
    {/if}

    {#if dialogOpen[key] === 'alert'}
      <Dialog
        title="Fixture Remove Folder"
        alert
        description="Fixture: the folder and its index will be removed."
        onclose={() => (dialogOpen[key] = null)}
      >
        {#snippet footer()}
          <Button variant="destructive" onclick={() => (dialogOpen[key] = null)}>Remove</Button>
          <Button onclick={() => (dialogOpen[key] = null)}>Cancel</Button>
        {/snippet}
        <p class="hs-caption">Fixture dialog content.</p>
      </Dialog>
    {/if}
  </div>
{/snippet}

<section id="overlays" class="section">
  <h2 class="hs-title-3">Overlays</h2>
  <p class="hs-caption section-note">
    The popover menu and both dialog shapes. Both are opened by their buttons so they do not cover
    the page on load.
  </p>
  <div class="compare">
    <div class="scheme" data-scheme="light">
      {@render stateLabel('Light')}
      {@render overlaysDemo('light')}
    </div>
    <div class="scheme" data-scheme="dark">
      {@render stateLabel('Dark')}
      {@render overlaysDemo('dark')}
    </div>
  </div>
</section>

<footer class="outro">
  <p class="hs-caption">End of the fixture showcase. Remove this route before packaging the app.</p>
</footer>

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    padding: var(--hs-space-8) 0 var(--hs-space-6);
  }

  .intro-kicker {
    margin: 0;
    color: var(--hs-accent-text);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .intro-text {
    max-width: 70ch;
    margin: 0;
    color: var(--hs-fg-muted);
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    padding: var(--hs-space-8) 0;
    border-top: 1px solid var(--hs-separator);
  }

  .section-note {
    margin: 0;
    color: var(--hs-fg-muted);
  }

  .compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--hs-space-4);
    align-items: start;
  }

  @media (max-width: 1100px) {
    .compare {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  .scheme {
    min-width: 0;
    padding: var(--hs-space-5);
    border: 1px solid var(--hs-separator);
    border-radius: var(--hs-radius-card);
    background: var(--hs-view-bg);
    color: var(--hs-fg);
  }

  .state {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    padding: var(--hs-space-4) 0;
    border-top: 1px solid var(--hs-separator);
  }

  .state:first-of-type {
    border-top: 0;
    padding-top: 0;
  }

  .state-label {
    margin: 0;
    color: var(--hs-fg-muted);
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--hs-space-3);
  }

  .tall {
    align-items: center;
    gap: var(--hs-space-5);
  }

  .stack {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    max-width: 420px;
  }

  .stack.wide {
    max-width: 620px;
  }

  .stack.narrow {
    max-width: 320px;
  }

  .sidebar-field {
    width: 200px;
  }

  .popover-space {
    padding-bottom: 260px;
  }

  .cover {
    display: block;
    width: 112px;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: var(--hs-radius-card);
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--hs-space-5);
    align-items: start;
  }

  .border {
    border: 1px solid var(--hs-separator);
    border-radius: var(--hs-radius-card);
    overflow: hidden;
  }

  .placeholder-rows {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .menu-row {
    align-items: flex-start;
  }

  .outro {
    padding: var(--hs-space-6) 0 var(--hs-space-8);
    border-top: 1px solid var(--hs-separator);
    color: var(--hs-fg-muted);
  }
</style>
