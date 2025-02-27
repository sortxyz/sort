import type { Meta, StoryObj } from "@storybook/react";
import {
  Tabs,
  TabsLabel,
  TabsList,
  TabsListTab,
  TabsPanel,
} from "~/components/tabs";

const meta = {
  component: Tabs,
} satisfies Meta<typeof Tabs>;

export default meta;

type Story = StoryObj<typeof Tabs>;

export const Basic: Story = {
  args: {
    asTabs: true,
    children: (
      <>
        <TabsList label={<TabsLabel>Danish Composers</TabsLabel>}>
          <TabsListTab index={0}>Maria Ahlefeldt</TabsListTab>
          <TabsListTab index={1}>Carl Andersen</TabsListTab>
          <TabsListTab index={2}>Ida da Fonseca</TabsListTab>
          <TabsListTab index={3}>Peter Müller</TabsListTab>
        </TabsList>
        <TabsPanel index={0}>
          <p>
            Maria Theresia Ahlefeldt (16 January 1755 &mdash; 20 December 1810)
            was a Danish, (originally German), composer. She is known as the
            first female composer in Denmark. Maria Theresia composed music for
            several ballets, operas, and plays of the royal theatre. She was
            given good critic as a composer and described as a “
            <span lang="da">virkelig Tonekunstnerinde</span>” (&apos;a True
            Artist of Music&apos;).
          </p>
        </TabsPanel>
        <TabsPanel index={1}>
          <p>
            Carl Joachim Andersen (29 April 1847 &mdash; 7 May 1909) was a
            Danish flutist, conductor and composer born in Copenhagen, son of
            the flutist Christian Joachim Andersen. Both as a virtuoso and as
            composer of flute music, he is considered one of the best of his
            time. He was considered to be a tough leader and teacher and
            demanded as such a lot from his orchestras but through that style he
            reached a high level.
          </p>
        </TabsPanel>
        <TabsPanel index={2}>
          <p>
            Ida Henriette da Fonseca (July 27, 1802 &mdash; July 6, 1858) was a
            Danish opera singer and composer. Ida Henriette da Fonseca was the
            daughter of Abraham da Fonseca (1776&mdash;1849) and Marie Sofie
            Kiærskou (1784&mdash;1863). She and her sister Emilie da Fonseca
            were students of Giuseppe Siboni, choir master of the Opera in
            Copenhagen. She was given a place at the royal Opera alongside her
            sister the same year she debuted in 1827.
          </p>
        </TabsPanel>
        <TabsPanel index={3}>
          <p>
            Peter Erasmus Lange-Müller (1 December 1850 &mdash; 26 February
            1926) was a Danish composer and pianist. His compositional style was
            influenced by Danish folk music and by the work of Robert Schumann;
            Johannes Brahms; and his Danish countrymen, including J.P.E.
            Hartmann.
          </p>
        </TabsPanel>
      </>
    ),
  },
};
